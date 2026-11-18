import { PROMPTS } from './prompts.js';
import { stageWatchdog } from './stage-watchdog.js';

export const HARNESS_VERSION = 'recovery01-portable-v1';
export const MODES = Object.freeze(['direct', 'h0', 'h1', 'h2']);
export const BUDGETS = Object.freeze({ direct: 4096, plain: 512, state: 96, recover: 416, submit: 96 });
export const DEADLINES_MS = Object.freeze({ direct: 300000, plain: 150000, state: 90000, recover: 150000, submit: 90000 });
const FINAL_PREFIX = 'FINAL_ANSWER:';
const MAX_TEXT_CHARS = 2 * 1024 * 1024;

// Native visible contracts use only these fields. No keys, grades or review data are accepted.
export function visibleQuestion(question) {
  if (typeof question === 'string') {
    if (!question.trim()) throw new TypeError('Question is empty.');
    return { statement: question, options: {}, response_type: 'unspecified', answer_format: {} };
  }
  if (!question || typeof question !== 'object' || typeof question.statement !== 'string') {
    throw new TypeError('Use question text or a visible question contract.');
  }
  const type = question.response_type || 'unspecified';
  if (!Object.hasOwn(PROMPTS.typed, type)) throw new TypeError('Unsupported response_type.');
  const format = question.answer_format || {};
  const safeFormat = {};
  if (Object.hasOwn(format, 'require_integer')) {
    if (typeof format.require_integer !== 'boolean') throw new TypeError('require_integer must be boolean.');
    safeFormat.require_integer = format.require_integer;
  }
  if (Object.hasOwn(format, 'max_decimal_places')) {
    if (!Number.isInteger(format.max_decimal_places) || format.max_decimal_places < 0) throw new TypeError('Invalid decimal-place rule.');
    safeFormat.max_decimal_places = format.max_decimal_places;
  }
  const options = question.options || {};
  if (Array.isArray(options) || typeof options !== 'object') throw new TypeError('Options must map printed labels to text.');
  const safeOptions = {};
  for (const [label, value] of Object.entries(options)) {
    if (typeof value !== 'string') throw new TypeError('Each option must contain text.');
    Object.defineProperty(safeOptions, label, { value, enumerable: true });
  }
  return { statement: question.statement, options: safeOptions, response_type: type, answer_format: safeFormat };
}

// Matches Python's sorted, ensure_ascii=False contract layout for the supported JSON fields.
export function contractJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(contractJSON).join(', ') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ': ' + contractJSON(value[k])).join(', ') + '}';
  return JSON.stringify(value);
}

export function parseTaskState(raw) {
  try {
    const text = String(raw).trim();
    const state = JSON.parse(text);
    const names = ['established', 'remaining', 'next_task'];
    if (!state || Array.isArray(state) || Object.keys(state).length !== 3 || !names.every(k => Object.hasOwn(state, k))) return null;
    if (names.some(k => typeof state[k] !== 'string' || !state[k].trim() || [...state[k]].length > 400)) return null;
    // JSON.parse silently accepts duplicate keys; the frozen native parser rejects them.
    const strings = text.match(/"(?:\\.|[^"\\])*"/g) || [];
    if (strings.length !== 6 || new Set([0, 2, 4].map(i => JSON.parse(strings[i]))).size !== 3) return null;
    return state;
  } catch { return null; }
}

export function makePrompts(question, directPrompt) {
  const visible = visibleQuestion(question);
  const contract = contractJSON(visible);
  const direct = directPrompt ?? (typeof question === 'string' ? question : PROMPTS.direct + '\nQuestion: ' + contract);
  if (typeof direct !== 'string' || !direct.trim()) throw new TypeError('Direct prompt is empty.');
  const task = (instruction, draft, state) => instruction + '\nVISIBLE QUESTION CONTRACT:\n' + contract
    + '\nUNFINISHED SOLVER DRAFT:\n' + draft
    + (state ? '\nPROPOSED TASK STATE (UNVERIFIED):\n' + contractJSON(state) : '');
  return {
    direct,
    submit: draft => task(PROMPTS.submit + '\n' + PROMPTS.typed[visible.response_type], draft),
    state: draft => task(PROMPTS.state, draft),
    recover: (draft, state) => task(PROMPTS.recover, draft, state),
  };
}

function interrupted(code, message) { const e = new Error(message); e.code = code; return e; }
function receipt(raw, maxTokens) {
  if (!raw || typeof raw.text !== 'string') throw new TypeError('Generator must return text.');
  const tokens = raw.tokens ?? raw.generation_tokens;
  const finishReason = raw.finishReason ?? raw.finish_reason;
  if (!Number.isInteger(tokens) || tokens < 0 || tokens > maxTokens) throw new TypeError('Generator exceeded its token budget or omitted its token count.');
  if (!['stop', 'length'].includes(finishReason)) {
    const code = finishReason === 'cancelled' ? 'ABORTED' : finishReason === 'time_limit' ? 'TIME_LIMIT' : 'GENERATION_STOPPED';
    throw interrupted(code, 'Generation did not complete normally: ' + String(finishReason));
  }
  if (raw.text.length > MAX_TEXT_CHARS) throw interrupted('OUTPUT_LIMIT', 'Response exceeded the size guard.');
  return { ...raw, tokens, finishReason };
}

/**
 * Same-model orchestration. generate() returns only newly generated text, never its prefix.
 * It must honor signal and maxTokens, render userText followed by assistantPrefix literally,
 * and keep the model/adapter fixed for this entire invocation. No grading callback exists.
 */
export async function runHarness({ mode = 'h0', question, generate, signal, onEvent = () => {}, directMaxTokens = 4096,
  directPrompt, initialDraft, initialH0, images = [], progressTimeout, prepareSubmission, maxStageMs = Infinity, directDeadlineMs = DEADLINES_MS.direct } = {}) {
  if (!MODES.includes(mode)) throw new TypeError('Unknown harness mode.');
  if (typeof generate !== 'function') throw new TypeError('A generation adapter is required.');
  if (prepareSubmission !== undefined && typeof prepareSubmission !== 'function') throw new TypeError('prepareSubmission must be a function.');
  if (!Number.isInteger(directMaxTokens) || directMaxTokens < 1 || directMaxTokens > 4096) throw new TypeError('directMaxTokens must be 1–4096.');
  if (!(maxStageMs > 0)) throw new TypeError('maxStageMs must be positive.');
  if (!Number.isFinite(directDeadlineMs) || directDeadlineMs <= 0 || directDeadlineMs > 600000) throw new TypeError('directDeadlineMs must be positive and at most 600000.');
  if (mode !== 'direct' && directDeadlineMs !== DEADLINES_MS.direct) throw new TypeError('The legacy direct deadline override is only available in direct mode.');
  if (progressTimeout && (!Number.isSafeInteger(progressTimeout.idleMs) ||
      progressTimeout.idleMs < 1 || progressTimeout.idleMs > 2147483647)) {
    throw new TypeError('The idle timeout must be a positive timer delay in milliseconds.');
  }
  const prompts = makePrompts(question, directPrompt);
  const stages = [], warnings = [];
  const harnessId = HARNESS_VERSION + ':' + mode;
  let draft, terminal, workingText = '', activeStage, partial = '';
  const emit = event => onEvent({ harnessId, ...event });
  const output = (status, extra = {}) => ({ harnessId, mode, status, text: terminal?.text ?? workingText,
    terminalText: terminal?.text ?? '', workingText, finishReason: terminal?.finishReason ?? draft?.finishReason,
    stages, warnings, ...extra });

  async function call(stage, userText, assistantPrefix = '', promptBudget) {
    if (signal?.aborted) throw interrupted('ABORTED', 'Cancelled by user.');
    activeStage = stage; partial = '';
    const maxTokens = stage === 'direct' ? directMaxTokens : BUDGETS[stage];
    const fixedDeadline = stage === 'direct' ? directDeadlineMs : DEADLINES_MS[stage];
    const limitMs = progressTimeout ? maxStageMs : Math.min(fixedDeadline, maxStageMs);
    const deadlineMs = Number.isFinite(limitMs) ? limitMs : null;
    const idleTimeoutMs = progressTimeout?.idleMs;
    const controller = new AbortController();
    let rejectStop;
    const stop = new Promise((_, reject) => { rejectStop = reject; });
    const halt = (code, message) => {
      if (controller.signal.aborted) return;
      const error = interrupted(code, message);
      rejectStop(error);
      controller.abort(error);
    };
    const abort = () => halt('ABORTED', 'Cancelled by user.');
    signal?.addEventListener('abort', abort, { once: true });
    const clock = stageWatchdog({ deadlineMs, idleTimeoutMs, maxTokens, onTimeout: halt,
      onProgress: progress => emit({ type: 'stage-progress', stage, ...progress }) });
    emit({ type: 'stage-start', stage, maxTokens, deadlineMs });
    const started = performance.now();
    try {
      const pending = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return generate({
          stage, userText, assistantPrefix, maxTokens, deadlineMs,
          signal: controller.signal, images, temperature: 0, enableThinking: false,
          onProgress: idleTimeoutMs ? progress => { if (!controller.signal.aborted) clock.progress(progress); } : undefined,
          onToken: text => {
            if (controller.signal.aborted) return;
            partial += String(text);
            if (partial.length > MAX_TEXT_CHARS) { halt('OUTPUT_LIMIT', 'Response exceeded the size guard.'); return; }
            emit({ type: 'token', stage, text: String(text) });
          },
        });
      });
      const raw = await Promise.race([pending, stop]);
      if (idleTimeoutMs) { clock.check(); controller.signal.throwIfAborted(); }
      if (typeof raw?.text === 'string') partial = raw.text;
      const value = receipt(raw, maxTokens);
      if (signal?.aborted) throw interrupted('ABORTED', 'Cancelled by user.');
      const record = { ...value, stage, status: 'completed', maxTokens, deadlineMs, assistantPrefix,
        userText, measuredSeconds: (performance.now() - started) / 1000,
        ...(promptBudget ? { promptBudget } : {}) };
      if (idleTimeoutMs) Object.assign(record, { idleTimeoutMs, progress: clock.latest });
      stages.push(record); emit({ type: 'stage-complete', stage, receipt: record }); return record;
    } catch (error) {
      // A backend can fail at the same instant as a delayed browser timer.
      if (idleTimeoutMs && !controller.signal.aborted) clock.check();
      if (controller.signal.aborted && controller.signal.reason?.code) error = controller.signal.reason;
      controller.abort();
      stages.push({ stage, status: 'interrupted', code: error.code || error.name, partialText: partial, maxTokens, deadlineMs,
        ...(idleTimeoutMs ? { idleTimeoutMs, progress: clock.latest } : {}),
        ...(promptBudget ? { promptBudget } : {}),
        userText, assistantPrefix, measuredSeconds: (performance.now() - started) / 1000 });
      throw error;
    } finally { clock.close(); signal?.removeEventListener('abort', abort); }
  }

  async function submit(text) {
    activeStage = 'submit'; partial = '';
    let prepared;
    try {
      prepared = prepareSubmission
        ? prepareSubmission({ question, draft: text, assistantPrefix: FINAL_PREFIX })
        : { userText: prompts.submit(text) };
    } catch (error) {
      stages.push({ stage: 'submit', status: 'interrupted', code: error.code || error.name,
        preparationFailed: true, maxTokens: BUDGETS.submit, measuredSeconds: 0 });
      throw error;
    }
    if (prepared.promptBudget?.omittedDraftCharacters) warnings.push('The final-answer step used a shortened copy of the draft to fit. The full working is shown below.');
    const value = await call('submit', prepared.userText, FINAL_PREFIX, prepared.promptBudget);
    return { ...value, text: FINAL_PREFIX + value.text };
  }
  async function reference() {
    if (initialH0) return { ...receipt(initialH0, 96), reused: true };
    return submit(draft.text);
  }
  try {
    if (signal?.aborted) throw interrupted('ABORTED', 'Cancelled by user.');
    draft = initialDraft ? { ...receipt(initialDraft, directMaxTokens), reused: true } : await call('direct', prompts.direct);
    workingText = draft.text;
    if (mode === 'direct' || draft.finishReason !== 'length') {
      terminal = draft; return output('completed', { routed: false });
    }
    if (mode === 'h0') { terminal = await reference(); return output('completed', { routed: true }); }
    if (mode === 'h1') {
      const continuation = await call('plain', prompts.direct, draft.text);
      workingText = draft.text + continuation.text;
      terminal = await submit(workingText);
      return output('completed', { routed: true });
    }
    const proposal = await call('state', prompts.state(draft.text));
    const state = parseTaskState(proposal.text);
    const task = state?.next_task.trim().toLowerCase();
    if (!state || ['unreadable', 'submit_supported_result'].includes(task)) {
      const reason = state ? 'State requests ' + task : 'Malformed state';
      warnings.push(reason + '; retained the H0 submission policy. This is not a successful recovery.');
      terminal = await reference();
      return output('completed', { routed: true, fallback: true, fallbackReason: reason, taskState: state });
    }
    const recovery = await call('recover', prompts.recover(draft.text, state));
    workingText = draft.text + '\n\nRECOVERY ATTEMPT:\n' + recovery.text;
    terminal = await submit(workingText);
    return output('completed', { routed: true, fallback: false, taskState: state });
  } catch (error) {
    const code = error.code || error.name || 'ERROR';
    const cancelled = code === 'ABORTED' || code === 'AbortError';
    if (activeStage === 'direct' && !workingText) workingText = partial;
    warnings.push((cancelled ? 'Cancelled' : 'Stopped') + ': ' + error.message + ' Saved working is unverified; no successful recovery is claimed.');
    return output(cancelled ? 'cancelled' : 'blocked', { interruptedStage: activeStage, errorCode: code, partialStageText: partial });
  }
}
