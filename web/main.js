import 'katex/dist/katex.min.css';
import './style.css';
import { formatSolution, formatInline } from './format.js';
import { ARCHIVED_MODELS } from './archive-config.js';
import { QWEN4B_MODELS } from './qwen4b-config.js';
import { buildSolverPrompt, checkRestAccelerationDisplacement, inspectSolution, displayFinalAnswer, inspectRecoveryAnswer, MAX_QUESTION_CHARS, suggestSubject } from './harness.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'llamajee.chats.v1';
const MAX_SAVED_CHATS = 100;
// Element IDs that always point at the newest model response (used by the browser smoke tests).
const LIVE_IDS = ['solve-progress', 'solve-phase', 'solve-count', 'reading-progress', 'final-card', 'final-answer', 'format-checks', 'working-label', 'raw-output'];
const EXAMPLES = [
  { label: 'Physics · kinematics', text: 'A particle starts from rest and moves with a constant acceleration of 2 m/s². Find its displacement in the first 3 s.', subject: 'physics', exam: 'main', answerType: 'numeric' },
  { label: 'Maths · equations', text: 'Find the number of real solutions of the equation x² − 5|x| + 6 = 0.', subject: 'mathematics', exam: 'main', answerType: 'numeric' },
  { label: 'Chemistry · pH', text: 'What is the pH of a 0.001 M aqueous HCl solution at 25 °C? Assume complete dissociation.', subject: 'chemistry', exam: 'main', answerType: 'numeric' },
];
const TRASH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6.5 7l.8 11.2A2 2 0 009.3 20h5.4a2 2 0 002-1.8L17.5 7M9 7V5h6v2"/></svg>';
const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>';

let worker;
const selection = () => $('model-choice').value;
const runtimeFor = (choice) => choice.startsWith('4b-') ? '4b' : choice === 'demo' ? 'demo' : 'archive';
const modelName = () => QWEN4B_MODELS[selection()] || ARCHIVED_MODELS[selection()] || 'Qwen3.5 0.8B · separate demo';
const shortModelName = () => $('model-choice').selectedOptions[0]?.textContent || modelName();
let modelReady = false;
let modelLoading = false;
let solving = false;
let draining = false;
let selectedFile = null;
let previewUrl = null;
let streamed = '';
let currentAnswerType = 'infer';
let currentQuestion = '';
let lastSolveProgress = null;
let liveMsg = null;
let liveChatId = null;
let hintIsError = false;
let lastLockState = null;
let previewMode = false;
const fileProgress = new Map();

/* ---------- Saved chats ---------- */
let chats = loadChats();
let activeId = null;

function loadChats() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    for (const chat of value) {
      chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
      for (const m of chat.messages) {
        if (m.role === 'assistant' && m.state === 'pending') {
          m.state = 'interrupted';
          m.stateLabel = 'Interrupted';
          m.notice = 'Generation stopped when the page was closed.';
        }
      }
    }
    return value;
  } catch { return []; }
}
function saveChats() {
  if (previewMode) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(chats.slice(0, MAX_SAVED_CHATS), (key, value) => key === 'imageUrl' ? undefined : value));
  } catch { /* Storage full or blocked: chats remain available until the page closes. */ }
}
const activeChat = () => chats.find((chat) => chat.id === activeId) || null;
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
function titleFor(question, file) {
  const line = question.split('\n').find((part) => part.trim())?.trim();
  if (!line) return file ? 'Image question' : 'New chat';
  return line.length > 52 ? `${line.slice(0, 50).trimEnd()}…` : line;
}

/* ---------- Small DOM helpers ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
const part = (row, role) => row.querySelector(`[data-role="${role}"]`);
function role(node, name) { node.dataset.role = name; return node; }
const nearBottom = () => { const s = $('scroller'); return s.scrollHeight - s.scrollTop - s.clientHeight < 140; };
function scrollToBottom(instant = false) {
  const s = $('scroller');
  if (instant) { s.style.scrollBehavior = 'auto'; s.scrollTop = s.scrollHeight; s.style.scrollBehavior = ''; }
  else s.scrollTop = s.scrollHeight;
}

/* ---------- Status ---------- */
function state(label, kind = '') {
  $('result-state').textContent = label;
  $('result-state').className = `state-pill ${kind}`;
}
function status(message) { $('model-status').textContent = message; }
function defaultHint() {
  if (!navigator.gpu) return 'This needs WebGPU. Try current Chrome or Edge on a desktop or laptop.';
  if (!modelReady) return 'Load a model to start. It runs on your device; nothing is sent to a server.';
  return 'Each message is solved as a new question. Answers can be wrong, so check the working.';
}
function composerHint(message = '', isError = false) {
  hintIsError = isError && Boolean(message);
  $('composer-hint').textContent = message || defaultHint();
  $('composer-hint').classList.toggle('error', hintIsError);
}
function composerError(message) { composerHint(message, true); }

function updateModelBar() {
  const value = !navigator.gpu ? 'unsupported' : modelReady ? 'ready' : modelLoading ? 'loading' : 'idle';
  $('model-bar').dataset.state = value;
  $('model-pill').dataset.state = value;
  $('model-pill-label').textContent = shortModelName();
  $('composer-model').textContent = modelReady ? `${shortModelName()} · on this device` : '';
}
function refreshControls() {
  $('load-button').disabled = !navigator.gpu || modelReady || modelLoading || solving;
  $('load-button').textContent = modelReady ? 'Model loaded' : modelLoading ? 'Loading model…' : 'Download and load';
  const hasInput = Boolean($('question').value.trim() || selectedFile);
  $('solve-button').disabled = !modelReady || solving || draining || !hasInput;
  $('solve-button').hidden = solving;
  $('cancel-button').hidden = !solving;
  $('cancel-button').disabled = !solving;
  $('model-choice').disabled = modelLoading || solving || draining;
  $('harness-choice').disabled = modelLoading || solving || draining;
  $('stop-button').disabled = !modelLoading && !solving && !modelReady;
  $('new-chat').disabled = solving;
  updateModelBar();
  if (lastLockState !== solving) { lastLockState = solving; renderSidebar(); }
  if (!hintIsError) composerHint();
}
function showProgress({ file, loaded, total }) {
  if (!file || !total) return;
  fileProgress.set(file, { loaded, total });
  const percent = Math.min(100, Math.round(loaded / total * 100));
  $('download-track').hidden = false;
  $('download-bar').style.width = `${percent}%`;
  status(`Downloading ${file.split('/').at(-1)} · ${Math.round(loaded / 1e6)} / ${Math.round(total / 1e6)} MB (this file)`);
}

/* ---------- Sidebar ---------- */
function renderSidebar() {
  const list = $('chat-list');
  list.replaceChildren();
  if (!chats.length) { list.append(el('p', 'chat-list-empty', 'Your questions will appear here.')); return; }
  for (const chat of chats) {
    const item = el('div', `chat-item${chat.id === activeId ? ' active' : ''}`);
    const open = el('button', 'chat-open', chat.title || 'New chat');
    open.type = 'button';
    open.title = chat.title || 'New chat';
    open.disabled = solving && chat.id !== activeId;
    if (chat.id === activeId) open.setAttribute('aria-current', 'page');
    open.addEventListener('click', () => selectChat(chat.id));
    const remove = el('button', 'chat-delete');
    remove.type = 'button';
    remove.innerHTML = TRASH_ICON;
    remove.disabled = solving;
    remove.setAttribute('aria-label', `Delete chat: ${chat.title}`);
    remove.title = 'Delete chat';
    remove.addEventListener('click', () => deleteChat(chat.id));
    item.append(open, remove);
    list.append(item);
  }
}
function selectChat(id) {
  if (solving) return;
  activeId = id;
  renderChat(); renderSidebar(); closePanels();
  $('question').focus();
}
function newChat() {
  if (solving) return;
  activeId = null;
  renderChat(); renderSidebar(); closePanels();
  $('question').focus();
}
function deleteChat(id) {
  if (solving) return;
  const chat = chats.find((c) => c.id === id);
  if (!chat || !window.confirm(`Delete “${chat.title}”?`)) return;
  chats = chats.filter((c) => c.id !== id);
  if (activeId === id) activeId = null;
  saveChats(); renderChat(); renderSidebar();
}

/* ---------- Conversation ---------- */
function userBubble(m) {
  const row = el('div', 'msg msg-user');
  const bubble = el('div', 'bubble');
  if (m.imageUrl) {
    const img = el('img', 'bubble-image');
    img.src = m.imageUrl;
    img.alt = 'Attached question image';
    bubble.append(img);
  } else if (m.imageName) bubble.append(el('div', 'bubble-file', `Image: ${m.imageName}`));
  if (m.text) bubble.append(el('div', 'bubble-text', m.text));
  row.append(bubble);
  return row;
}
function assistantMessage(m) {
  const row = el('article', 'msg msg-assistant');
  row.setAttribute('aria-label', 'Model response');
  const avatar = el('div', 'avatar', 'lj');
  avatar.setAttribute('aria-hidden', 'true');
  const body = el('div', 'msg-body');
  const meta = el('div', 'msg-meta', [m.model, m.harness].filter(Boolean).join(' · '));

  const progress = role(el('div', 'solve-progress'), 'solve-progress');
  const heading = el('div', 'progress-heading');
  const dots = el('span', 'typing');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(el('i'), el('i'), el('i'));
  const phase = role(el('strong'), 'solve-phase');
  phase.setAttribute('role', 'status');
  heading.append(dots, phase, role(el('span', 'solve-count'), 'solve-count'));
  const bar = role(el('progress'), 'reading-progress');
  bar.hidden = true;
  progress.append(heading, bar);

  const finalCard = role(el('div', 'final-card'), 'final-card');
  finalCard.append(el('span', '', 'Final answer'), role(el('strong'), 'final-answer'));
  const checks = role(el('div', 'format-checks'), 'format-checks');
  const working = role(el('details', 'working'), 'working');
  working.open = true;
  const raw = role(el('pre', 'working-raw'), 'raw-output');
  raw.hidden = true;
  working.append(role(el('summary', '', 'Working'), 'working-label'), role(el('div', 'working-text formatted'), 'formatted'), raw);
  const foot = role(el('div', 'msg-foot'), 'foot');

  body.append(meta, progress, finalCard, checks, working, foot);
  row.append(avatar, body);
  paintAssistant(row, m);
  return row;
}
function setWorking(row, visible, label = 'Working') {
  part(row, 'working').hidden = !visible;
  part(row, 'working-label').hidden = !visible;
  part(row, 'working-label').textContent = label;
}
function renderChecks(box, notice, issues = []) {
  box.replaceChildren();
  if (!notice && !issues?.length) { box.hidden = true; return; }
  box.hidden = false;
  if (notice) box.append(el('p', '', notice));
  if (issues?.length) {
    const list = el('ul');
    for (const issue of issues) list.append(el('li', '', issue));
    box.append(el('strong', '', 'Items to check'), list);
  }
}
function renderFoot(row, m) {
  const foot = part(row, 'foot');
  foot.replaceChildren();
  if (m.state === 'pending') return;
  const labels = { done: 'Finished · unverified', review: 'Review needed', interrupted: m.stateLabel || 'Interrupted', error: 'Needs attention' };
  foot.append(el('span', `foot-state ${m.state}`, labels[m.state] || ''));
  if (m.stats) foot.append(el('span', 'foot-stats', m.stats));
  if ((m.raw || '').trim()) {
    const view = el('button', 'foot-toggle', m.view === 'raw' ? 'Show formatted' : 'Show raw text');
    view.type = 'button';
    view.addEventListener('click', () => {
      m.view = m.view === 'raw' ? 'formatted' : 'raw';
      paintWorking(row, m);
      view.textContent = m.view === 'raw' ? 'Show formatted' : 'Show raw text';
      saveChats();
    });
    foot.append(view);
    const copy = el('button', 'icon-button foot-copy');
    copy.type = 'button';
    copy.innerHTML = COPY_ICON;
    copy.title = 'Copy response';
    copy.setAttribute('aria-label', 'Copy response');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText((m.final ? `Final answer: ${m.final}\n\n` : '') + m.raw);
        copy.classList.add('done');
        setTimeout(() => copy.classList.remove('done'), 1200);
      } catch { /* Clipboard permission denied. */ }
    });
    foot.append(copy);
  }
}
function paintWorking(row, m) {
  const raw = m.raw || '';
  const showRaw = m.view === 'raw';
  part(row, 'raw-output').textContent = raw;
  part(row, 'raw-output').hidden = !showRaw;
  part(row, 'formatted').hidden = showRaw;
  if (!showRaw) part(row, 'formatted').innerHTML = formatSolution(raw);
}
// Formatting runs at most once per animation frame while text streams in.
let formatFrame = 0;
function scheduleWorking(row, m) {
  part(row, 'raw-output').textContent = m.raw || '';
  if (formatFrame) return;
  formatFrame = requestAnimationFrame(() => { formatFrame = 0; if (row.isConnected) paintWorking(row, m); });
}
function paintAssistant(row, m) {
  const raw = m.raw || '';
  paintWorking(row, m);
  setWorking(row, Boolean(raw.trim()), m.workingLabel || 'Working');
  part(row, 'final-card').hidden = !m.final;
  part(row, 'final-answer').innerHTML = formatInline(m.final || '');
  renderChecks(part(row, 'format-checks'), m.notice, m.issues);
  const pending = m.state === 'pending';
  part(row, 'solve-progress').hidden = !pending;
  if (pending && !part(row, 'solve-phase').textContent) part(row, 'solve-phase').textContent = 'Starting…';
  renderFoot(row, m);
}
function bindCurrent() {
  for (const id of LIVE_IDS) $(id)?.removeAttribute('id');
  const rows = $('thread').querySelectorAll('.msg-assistant');
  const row = rows[rows.length - 1];
  if (row) for (const id of LIVE_IDS) part(row, id)?.setAttribute('id', id);
  return row || null;
}
function liveRow() {
  if (!liveChatId || liveChatId !== activeId) return null;
  const rows = $('thread').querySelectorAll('.msg-assistant');
  return rows[rows.length - 1] || null;
}
function renderChat() {
  const chat = activeChat();
  const thread = $('thread');
  thread.replaceChildren();
  $('chat-title').textContent = chat?.title || 'New chat';
  document.title = chat ? `${chat.title} · LlamaJEE.js` : 'LlamaJEE.js — JEE solver in your browser';
  const empty = !chat || !chat.messages.length;
  $('empty-state').hidden = !empty;
  thread.hidden = empty;
  if (empty) return;
  for (const m of chat.messages) thread.append(m.role === 'user' ? userBubble(m) : assistantMessage(m));
  bindCurrent();
  // Open a saved chat at its latest question, so the question and answer are both visible.
  const users = thread.querySelectorAll('.msg-user');
  const lastUser = users[users.length - 1];
  const scroller = $('scroller');
  scroller.style.scrollBehavior = 'auto';
  scroller.scrollTop = lastUser ? Math.max(0, lastUser.offsetTop - 12) : scroller.scrollHeight;
  scroller.style.scrollBehavior = '';
}
function renderExamples() {
  const box = $('examples');
  EXAMPLES.forEach((example, index) => {
    const button = el('button', 'example');
    button.type = 'button';
    if (index === 0) button.id = 'example-button';
    button.append(el('small', '', example.label), document.createTextNode(example.text));
    button.addEventListener('click', () => {
      $('question').value = example.text;
      $('subject').value = example.subject;
      $('exam').value = example.exam;
      $('answer-type').value = example.answerType;
      autosize(); composerHint(); refreshControls();
      $('question').focus();
    });
    box.append(button);
  });
}

/* ---------- Generation lifecycle ---------- */
const stagePhases = {
  direct: ['Reading the question', 'Writing the answer'],
  plain: ['Reading the question and draft', 'Continuing the answer'],
  state: ['Reading the question and draft', 'Identifying the remaining task'],
  recover: ['Reading the question and task', 'Working on the remaining task'],
  submit: ['Reading the draft for a final answer', 'Writing the final answer'],
};

function showSolveProgress(progress) {
  const row = liveRow();
  if (!row) return;
  const { phase, stage, processed, total } = progress;
  const reading = phase === 'reading';
  const label = stagePhases[stage]?.[reading ? 0 : 1] || 'Working';
  const heading = part(row, 'solve-phase');
  // Only announce phase changes. The live token count remains available on demand.
  if (heading.textContent !== label || lastSolveProgress?.stage !== stage) {
    heading.textContent = label;
    status(label + '…');
  }
  part(row, 'solve-progress').hidden = false;
  part(row, 'solve-count').textContent = reading ? `${processed} of ${total} input tokens` : `${processed} tokens written · limit ${total}`;
  const bar = part(row, 'reading-progress');
  bar.hidden = !reading;
  if (reading) { bar.max = total; bar.value = processed; }
  lastSolveProgress = progress;
}

function finishLive(updates) {
  if (!liveMsg) return;
  Object.assign(liveMsg, updates);
  const row = liveRow();
  const chat = chats.find((c) => c.id === liveChatId);
  if (chat) chat.updatedAt = Date.now();
  if (row) paintAssistant(row, liveMsg);
  liveMsg = null;
  liveChatId = null;
  saveChats();
  renderSidebar();
}

function finishInterruption(data, raw) {
  const { status: outcome, errorCode, interruptedStage, stages } = data.harness;
  const record = stages?.at(-1);
  const progress = record?.progress || (lastSolveProgress?.stage === interruptedStage ? lastSolveProgress : null);
  const phase = progress && stagePhases[interruptedStage]?.[progress.phase === 'reading' ? 0 : 1];
  const when = phase ? ' while ' + phase.toLowerCase() : '';
  const reasons = {
    STALL_TIMEOUT: 'The model stopped making progress' + when + '.',
    HARD_TIMEOUT: 'The stage reached its maximum time' + when + '.',
    DEADLINE: 'The stage reached its time limit' + when + '.',
    TIME_LIMIT: 'The stage reached its time limit' + when + '.',
    REPETITION: 'The model stopped after repeating its working.',
  };
  let reason = reasons[errorCode] || data.harness.warnings?.at(-1)?.replace(/ Saved working is unverified; no successful recovery is claimed\.$/, '') || 'Generation stopped.';
  if (outcome === 'cancelled') reason = 'You stopped generation.';
  const hasWorking = Boolean(raw.trim());
  state(outcome === 'cancelled' ? 'Stopped' : 'Interrupted', 'error');
  status(draining ? 'Waiting for the device to finish the last operation. You can release the model now.' : 'The model is still loaded. You can ask another question.');
  finishLive({
    raw, final: '', issues: [],
    notice: reason + (hasWorking ? ' The partial working is shown below.' : ' No answer text was returned.'),
    stats: Number.isFinite(data.seconds) ? `${data.seconds.toFixed(1)} s` : '',
    state: 'interrupted', stateLabel: outcome === 'cancelled' ? 'Stopped' : 'Interrupted',
    workingLabel: 'Partial working · unverified',
  });
}

function showError(message) {
  const wasSolving = solving;
  modelLoading = false;
  solving = false;
  state('Needs attention', 'error');
  status(message);
  if (wasSolving && liveMsg) {
    finishLive({ raw: streamed, final: '', issues: [], notice: message, state: 'error', workingLabel: streamed.trim() ? 'Partial working · unverified' : 'Working' });
  } else composerError(message);
  refreshControls();
}

function createWorker() {
  worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data, currentTarget }) => {
    if (currentTarget !== worker) return;
    if (data.type === 'drain-complete') {
      draining = false;
      status('The model is ready for another question.');
      refreshControls();
      return;
    }
    if (data.type === 'status') status(data.message);
    if (data.type === 'progress') showProgress(data);
    if (data.type === 'solve-progress' && solving) showSolveProgress(data);
    if (data.type === 'ready') {
      modelReady = true;
      modelLoading = false;
      $('download-track').hidden = true;
      status(`Ready. ${modelName()} will answer on this device.`);
      if (!solving) state('Ready', 'active');
      composerHint();
      refreshControls();
      $('question').focus();
    }
    if (data.type === 'token') {
      streamed = data.fullText ?? (streamed + (data.text || ''));
      if (liveMsg) liveMsg.raw = streamed;
      const row = liveRow();
      if (row) {
        const stick = nearBottom();
        if (liveMsg) scheduleWorking(row, liveMsg);
        setWorking(row, Boolean(streamed.trim()), 'Working');
        if (stick) scrollToBottom(true);
      }
    }
    if (data.type === 'complete') {
      solving = false;
      $('download-track').hidden = true;
      draining = Boolean(data.draining);
      const interrupted = ['cancelled', 'blocked'].includes(data.harness?.status);
      const raw = interrupted ? streamed || data.text || '' : data.text || streamed;
      if (interrupted) {
        finishInterruption(data, raw);
        refreshControls();
        return;
      }
      const stats = typeof data.tokens === 'number' ? `${data.tokens} tokens · ${data.seconds.toFixed(1)} s` : '';
      const check = inspectSolution(raw, currentAnswerType);
      const finalDisplay = displayFinalAnswer(check.final);
      const calculation = checkRestAccelerationDisplacement(currentQuestion, finalDisplay);
      const stopIssue = ['repetition', 'time_limit', 'length', 'cancelled', 'blocked'].includes(data.stopReason) ? [`Generation stopped: ${data.stopReason}. The answer may be incomplete.`] : [];
      const recoveryFormatIssue = data.harness?.routed && data.harness?.terminalText ? inspectRecoveryAnswer(data.harness.terminalText, currentAnswerType) : '';
      const issues = [...(recoveryFormatIssue ? [recoveryFormatIssue] : []), ...(data.warnings || []), ...stopIssue, ...check.issues, ...(calculation?.issue ? [calculation.issue] : [])];
      const needsReview = !check.formatComplete || issues.length > 0;
      state(needsReview ? 'Review needed' : 'Finished · unverified', needsReview ? 'error' : 'active');
      status(calculation?.issue ? 'A narrow independent browser calculation disagrees with the model. Inspect the working.' : `Completed. ${check.formatComplete ? 'The requested sections are present.' : 'Some requested sections are missing.'} Most mathematical steps remain unverified.`);
      finishLive({ raw, final: check.final ? finalDisplay : '', issues, notice: '', stats, state: needsReview ? 'review' : 'done', workingLabel: 'Working' });
      refreshControls();
    }
    if (data.type === 'error') showError(data.message);
  });
  worker.addEventListener('error', (error) => showError(`Model worker failed: ${error.message}`));
}
function resetWorker() {
  worker?.terminate(); createWorker();
  modelReady = false; modelLoading = false; solving = false; draining = false;
  fileProgress.clear();
  $('download-track').hidden = true;
  refreshControls();
}

/* ---------- Model and settings ---------- */
function describeModel() {
  const kind = runtimeFor(selection());
  const size = kind === '4b' ? 'Up to 3.1 GB to download. Files can stay in this browser’s cache.' : kind === 'demo' ? 'About 850 MB to download.' : 'Up to 5.7 GB to download. Using an image adds 1.84 GB.';
  $('model-label').textContent = modelName() + '.';
  $('model-detail').textContent = kind === '4b' ? 'Text questions. Best used on a desktop with enough memory.' : kind === 'demo' ? 'Smaller download. Accepts text and images.' : 'Larger model. Accepts text and images.';
  $('download-size').textContent = size;
  $('load-title').textContent = `Load ${shortModelName()} to start`;
  $('load-size').textContent = size;
  const textOnly = kind === '4b';
  $('image').disabled = textOnly;
  $('attach-button').setAttribute('aria-disabled', String(textOnly));
  $('attach-button').title = textOnly ? '4B accepts text only. Choose a 9B or 0.8B model in Settings to attach an image.' : 'Attach a question image (PNG or JPEG, up to 10 MB)';
  if (textOnly && selectedFile) setImage(null);
  updateModelBar();
}
function openSettings() {
  document.body.classList.add('settings-open');
  document.body.classList.remove('sidebar-open');
  $('settings').removeAttribute('inert');
  $('settings').setAttribute('aria-hidden', 'false');
  $('scrim').hidden = false;
  $('settings-close').focus();
}
function closePanels() {
  const settingsWasOpen = document.body.classList.contains('settings-open');
  document.body.classList.remove('settings-open', 'sidebar-open');
  $('settings').setAttribute('inert', '');
  $('settings').setAttribute('aria-hidden', 'true');
  $('scrim').hidden = true;
  if (settingsWasOpen) $('open-settings').focus();
}
function openSidebar() {
  document.body.classList.add('sidebar-open');
  $('scrim').hidden = false;
  $('new-chat').focus();
}

$('model-choice').addEventListener('change', () => {
  const next = runtimeFor(selection());
  if (next !== $('model-choice').dataset.runtime) resetWorker();
  $('model-choice').dataset.runtime = next;
  describeModel();
  status(modelReady ? 'Model selected. The next question uses this version; its model files stay loaded.' : 'Select “Download and load” to prepare this model.');
  refreshControls();
});
$('harness-choice').addEventListener('change', () => {
  const messages = {
    direct: 'One bounded response. Answers still need checking.',
    h0: 'If the response hits its token limit, ask the same model to write a final answer.',
    h1: 'If unfinished, continue the same response, then ask for a final answer. This adds time.',
    h2: 'If unfinished, identify the remaining task and try it before submitting. Experimental; this can still be wrong.',
  };
  $('harness-detail').textContent = messages[$('harness-choice').value];
});
$('cancel-button').addEventListener('click', () => {
  worker.postMessage({ type: 'cancel' });
  $('cancel-button').disabled = true;
  status('Stopping generation and keeping the model loaded…');
});
$('stop-button').addEventListener('click', () => {
  const wasSolving = solving;
  resetWorker();
  if (wasSolving && liveMsg) {
    finishLive({ raw: streamed, final: '', issues: [], notice: 'You released the model while it was generating. Any partial working is shown below.', state: 'interrupted', stateLabel: 'Stopped', workingLabel: 'Partial working · unverified' });
  }
  state('Stopped', 'error');
  status('Released model memory. Load the model again to continue; your chats remain.');
  refreshControls();
});
$('load-button').addEventListener('click', () => {
  if (modelReady || modelLoading) return;
  if (!navigator.gpu) { showError('WebGPU is not available in this browser. This preview needs a WebGPU-capable browser and device.'); return; }
  modelLoading = true;
  fileProgress.clear();
  state('Loading', 'active');
  status('Starting browser model download…');
  refreshControls();
  worker.postMessage({ type: 'load', checkpoint: selection() });
});

/* ---------- Composer ---------- */
function autosize() {
  const box = $('question');
  box.style.height = 'auto';
  box.style.height = `${Math.min(box.scrollHeight, 220)}px`;
}
function clearPreview() {
  $('image-preview').replaceChildren();
  $('image-preview').hidden = true;
}
function setImage(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  clearPreview();
  refreshControls();
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) { composerError('Choose a PNG or JPEG question image.'); $('image').value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { composerError('The image exceeds 10 MB. Crop or resize it before retrying.'); $('image').value = ''; return; }
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  const img = el('img');
  img.src = previewUrl;
  img.alt = 'Attached question';
  const remove = el('button', '', 'Remove');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove image');
  remove.addEventListener('click', () => { $('image').value = ''; setImage(null); $('question').focus(); });
  $('image-preview').append(img, el('span', '', file.name), remove);
  $('image-preview').hidden = false;
  composerHint();
  refreshControls();
}

async function send() {
  if (!modelReady || solving || draining) return;
  const question = $('question').value.trim();
  if (!question && !selectedFile) return;
  if (runtimeFor(selection()) === '4b' && selectedFile) return composerError('The 4B model accepts text only. Remove the image and paste the question, or choose a 9B / 0.8B model in Settings.');
  if (question.length > MAX_QUESTION_CHARS) return composerError(`Keep the question under ${MAX_QUESTION_CHARS} characters.`);
  let prompt;
  try {
    prompt = buildSolverPrompt({ question, hasImage: Boolean(selectedFile), subjectHint: $('subject').value, exam: $('exam').value, answerType: $('answer-type').value });
  } catch (error) { return composerError(error.message); }
  currentAnswerType = $('answer-type').value;
  currentQuestion = question;
  const classification = suggestSubject(question, $('subject').value);
  const file = selectedFile;
  const fileUrl = previewUrl;
  const imageBuffer = file ? await file.arrayBuffer() : null;

  let chat = activeChat();
  if (!chat) {
    chat = { id: newId(), title: titleFor(question, file), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    chats.unshift(chat);
    activeId = chat.id;
  }
  chat.updatedAt = Date.now();
  chats.sort((a, b) => b.updatedAt - a.updatedAt);
  chat.messages.push({ role: 'user', text: question, imageName: file?.name, imageUrl: fileUrl });
  liveMsg = { role: 'assistant', model: modelName(), harness: $('harness-choice').selectedOptions[0].textContent, raw: '', state: 'pending' };
  chat.messages.push(liveMsg);
  liveChatId = chat.id;
  saveChats();

  // Reset the composer. The image URL stays alive for the message bubble.
  $('question').value = '';
  autosize();
  selectedFile = null;
  previewUrl = null;
  $('image').value = '';
  clearPreview();
  composerHint();

  streamed = '';
  lastSolveProgress = null;
  solving = true;
  renderChat();
  state('Solving', 'active');
  status(`Subject: ${classification.subject}. Generating a response in this browser…`);
  refreshControls();
  const responseTypes = { infer: 'unspecified', single: 'single_select', multiple: 'multi_select', numeric: 'numeric' };
  const request = {
    type: 'solve', checkpoint: selection(), harness: $('harness-choice').value,
    questionContract: { statement: question || '[Question in the attached image]', options: {}, response_type: responseTypes[currentAnswerType], answer_format: {} },
    prompt, imageBuffer, imageType: file?.type, maxNewTokens: Number($('budget').value),
  };
  worker.postMessage(request, imageBuffer ? [imageBuffer] : []);
}

$('solve-form').addEventListener('submit', (event) => { event.preventDefault(); send(); });
$('question').addEventListener('input', () => { autosize(); if (hintIsError) composerHint(); refreshControls(); });
$('question').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!$('solve-button').disabled) $('solve-form').requestSubmit();
  }
});
$('image').addEventListener('change', (event) => setImage(event.target.files?.[0] || null));
$('attach-button').addEventListener('click', (event) => {
  if ($('image').disabled) { event.preventDefault(); composerError($('attach-button').title); }
});

/* ---------- Theme ---------- */
const THEME_KEY = 'llamajee.theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function themePreference() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
}
function applyTheme(pref = themePreference()) {
  const dark = pref === 'dark' || (pref === 'system' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#080908' : '#f5f6f1';
  $('theme-choice').value = pref;
  const label = dark ? 'Switch to bright theme' : 'Switch to dark theme';
  $('theme-toggle').setAttribute('aria-label', label);
  $('theme-toggle').title = label;
}
function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* Preference lasts for this visit only. */ }
  applyTheme(pref);
}
$('theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('theme-choice').addEventListener('change', () => setTheme($('theme-choice').value));
darkQuery.addEventListener('change', () => { if (themePreference() === 'system') applyTheme(); });
applyTheme();

/* ---------- Panels ---------- */
$('new-chat').addEventListener('click', newChat);
$('open-settings').addEventListener('click', openSettings);
$('open-settings-side').addEventListener('click', openSettings);
$('model-pill').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', closePanels);
$('sidebar-open').addEventListener('click', openSidebar);
$('sidebar-close').addEventListener('click', closePanels);
$('scrim').addEventListener('click', closePanels);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePanels(); });

/* ---------- Development-only layout preview (?preview) ---------- */
// Sample chats let the layout be reviewed without downloading a model. Vite removes this block from
// production builds, and preview chats are never written to browser storage.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview')) {
  previewMode = true;
  const now = Date.now();
  const sampleNote = 'Sample preview · not a real model output';
  chats = [
    { id: 'preview-1', title: 'A particle starts from rest and moves with a constant…', createdAt: now, updatedAt: now, messages: [
      { role: 'user', text: EXAMPLES[0].text },
      { role: 'assistant', model: sampleNote, harness: 'Final-answer recovery · H0', state: 'done', final: '9', stats: '412 tokens · 38.2 s',
        raw: 'PLAN:\nUse the constant-acceleration equation for displacement.\n\nWORK:\nGiven $u = 0$, $a = 2\\,\\text{m/s}^2$ and $t = 3\\,\\text{s}$.\n$$s = ut + \\tfrac{1}{2}at^2$$\n$$s = 0 \\times 3 + \\tfrac{1}{2} \\times 2 \\times 3^2 = 9\\,\\text{m}$$\n\nCHECK:\n- Units: $(\\text{m/s}^2)(\\text{s}^2) = \\text{m}$.\n- Final velocity $v = at = 6\\,\\text{m/s}$, so average velocity is $\\frac{0 + 6}{2} = 3\\,\\text{m/s}$ and $3 \\times 3 = 9\\,\\text{m}$, which agrees.\n\nFINAL_ANSWER:\n9' },
    ] },
    { id: 'preview-2', title: 'Find the number of real solutions of the equation…', createdAt: now - 3600e3, updatedAt: now - 3600e3, messages: [
      { role: 'user', text: EXAMPLES[1].text },
      { role: 'assistant', model: sampleNote, harness: 'Final-answer recovery · H0', state: 'review', final: '4', stats: '768 tokens · 71.0 s',
        issues: ['Generation stopped: length. The answer may be incomplete.'],
        raw: 'Let y = |x| ≥ 0. Then y² − 5y + 6 = 0, so (y − 2)(y − 3) = 0 and y = 2 or y = 3.\n\nBoth values are non-negative, so each gives two values of x: x = ±2 and x = ±3.\n\nCheck x = −3: 9 − 15 + 6 = 0. ✓\n\nFINAL ANSWER: 4' },
    ] },
    { id: 'preview-3', title: 'What is the pH of a 0.001 M aqueous HCl solution…', createdAt: now - 86400e3, updatedAt: now - 86400e3, messages: [] },
  ];
  activeId = 'preview-1';
}

/* ---------- Start ---------- */
createWorker();
$('model-choice').dataset.runtime = runtimeFor(selection());
describeModel();
renderExamples();
renderSidebar();
renderChat();
if (navigator.gpu) status('Browser graphics support detected.');
else { status('WebGPU not detected. Try current Chrome or Edge on a supported device.'); state('WebGPU needed', 'error'); }
refreshControls();
autosize();
