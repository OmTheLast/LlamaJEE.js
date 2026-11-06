import { Original9B } from './original9b.js';
import { Qwen4B } from './qwen4b.js';
import { ARCHIVE_ROOT } from './archive-config.js';
import { QWEN4B_ROOT } from './qwen4b-config.js';
import { runHarness } from '../harnesses/controller.js';
import { AutoProcessor, Qwen3_5ForConditionalGeneration, RawImage, TextStreamer, InterruptableStoppingCriteria } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION } from './harness.js';

let processor, model, loading, archive, small;
let busy = false, activeAbort, demoStop, generationSink;
const post = (message) => self.postMessage(message);
const runtimeNotice = (message) => {
  if (message.type === 'token' && generationSink) generationSink(message.fullText ?? message.text ?? '');
  else post(message);
};

async function ensureDemo() {
  if (model && processor) return;
  if (loading) return loading;
  loading = (async () => {
    if (!self.navigator?.gpu) throw new Error('WebGPU is unavailable. Try current Chrome or Edge on a supported device.');
    post({ type: 'status', message: 'Loading the 0.8B tokenizer and image processor…' });
    processor = await AutoProcessor.from_pretrained(MODEL_ID, { revision: MODEL_REVISION });
    model = await Qwen3_5ForConditionalGeneration.from_pretrained(MODEL_ID, {
      revision: MODEL_REVISION,
      dtype: { embed_tokens: 'q4', vision_encoder: 'fp16', decoder_model_merged: 'q4' }, device: 'webgpu',
      progress_callback: (p) => { if (p.status === 'progress') post({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total }); },
    });
  })();
  try { await loading; } catch (error) { loading = null; model = null; processor = null; throw error; }
}

async function ensureRuntime(checkpoint, signal) {
  if (checkpoint.startsWith('4b-')) {
    if (!QWEN4B_ROOT) throw new Error('The pinned 4B release is not configured yet.');
    small ||= new Qwen4B(QWEN4B_ROOT, runtimeNotice);
    await small.load(); small.checkpoint = checkpoint === '4b-base' ? 'base' : 'step30';
    await small.adapter(small.checkpoint, signal);
    return '4b';
  }
  if (checkpoint === 'demo') { await ensureDemo(); return 'demo'; }
  if (!ARCHIVE_ROOT) throw new Error('The 9B release is not configured.');
  archive ||= new Original9B(ARCHIVE_ROOT, runtimeNotice);
  await archive.load(); await archive.adapter(checkpoint);
  return '9b';
}

async function demoGenerate({ userText, assistantPrefix, maxTokens, signal, onToken }, imageBuffer, imageType) {
  const content = []; let image;
  if (imageBuffer) {
    image = await RawImage.read(new Blob([imageBuffer], { type: imageType }));
    const longest = Math.max(image.width, image.height);
    if (longest > 896) { const s = 896 / longest; image = await image.resize(Math.max(1, Math.round(image.width * s)), Math.max(1, Math.round(image.height * s))); }
    content.push({ type: 'image' });
  }
  content.push({ type: 'text', text: userText });
  const text = processor.apply_chat_template([{ role: 'user', content }], { add_generation_prompt: true, enable_thinking: false }) + assistantPrefix;
  const inputs = image ? await processor(text, image) : await processor(text);
  let streamed = ''; demoStop = new InterruptableStoppingCriteria();
  const abort = () => demoStop?.interrupt(); signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    const streamer = new TextStreamer(processor.tokenizer, { skip_prompt: true, skip_special_tokens: true,
      callback_function: (chunk) => { streamed += chunk; onToken(chunk); } });
    const started = performance.now();
    const outputs = await model.generate({ ...inputs, max_new_tokens: maxTokens, do_sample: false, streamer, stopping_criteria: [demoStop] });
    const suffix = outputs.slice(null, [inputs.input_ids.dims.at(-1), null]);
    const tokens = suffix.dims.at(-1), text = processor.batch_decode(suffix, { skip_special_tokens: true })[0] || streamed;
    return { text, tokens, finishReason: signal.aborted ? 'cancelled' : tokens >= maxTokens ? 'length' : 'stop', seconds: (performance.now() - started) / 1000 };
  } finally { signal.removeEventListener('abort', abort); demoStop = null; }
}

const stageLabels = { direct: 'Solving the question', plain: 'Continuing the unfinished response', state: 'Identifying the remaining task', recover: 'Working on the remaining task', submit: 'Writing the final answer' };

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') { activeAbort?.abort(); if (archive) archive.cancelled = true; demoStop?.interrupt(); return; }
  if (busy) { post({ type: 'error', message: 'A model operation is already running.' }); return; }
  busy = true;
  const pending = new Set();
  try {
    const checkpoint = data.checkpoint || '4b-step30';
    if (data.type === 'solve') activeAbort = new AbortController();
    const runtime = await ensureRuntime(checkpoint, activeAbort?.signal);
    if (data.type === 'load') { post({ type: 'ready', runtime, modelLoads: small?.loadCount }); return; }
    if (data.type !== 'solve') return;
    if (runtime === '4b' && data.imageBuffer) throw new Error('The 4B browser release accepts text only. Paste the full question, or select a 9B/0.8B model for an image.');
    const generated = async (request) => {
      let value;
      if (runtime === '4b') {
        let sent = '';
        value = await small.generate({ ...request, onToken: (full) => { const delta = full.slice(sent.length); sent = full; request.onToken(delta); } });
      } else if (runtime === '9b') {
        let sent = '';
        generationSink = (full) => { const delta = full.slice(sent.length); sent = full; request.onToken(delta); };
        const abort = () => { archive.cancelled = true; };
        request.signal.addEventListener('abort', abort, { once: true });
        try {
          const raw = await archive.solve({ prompt: request.userText, assistantPrefix: request.assistantPrefix,
            imageBuffer: data.imageBuffer, imageType: data.imageType, checkpoint, maxNewTokens: request.maxTokens,
            signal: request.signal, deadlineMs: request.deadlineMs });
          value = { ...raw, tokens: raw.generatedIds.length, finishReason: raw.stopReason };
        } finally { request.signal.removeEventListener('abort', abort); generationSink = null; }
      } else value = await demoGenerate(request, data.imageBuffer, data.imageType);
      if (!['stop', 'length'].includes(value.finishReason)) {
        const code = value.finishReason === 'cancelled' ? 'ABORTED' : value.finishReason.toUpperCase();
        throw Object.assign(new Error(`Generation stopped: ${value.finishReason}.`), { code });
      }
      return value;
    };
    const generate = (request) => {
      const promise = generated(request); pending.add(promise);
      promise.then(() => pending.delete(promise), () => pending.delete(promise));
      return promise;
    };
    let display = '', lastStage = '';
    const result = await runHarness({ mode: data.harness || 'direct', question: data.questionContract || data.prompt,
      directPrompt: data.prompt, directMaxTokens: data.maxNewTokens,
      directDeadlineMs: runtime !== '4b' && (data.harness || 'direct') === 'direct' ? 600000 : undefined,
      maxStageMs: runtime !== '4b' && (data.harness || 'direct') === 'direct' ? 600000 : 120000,
      generate, signal: activeAbort.signal,
      onEvent: (event) => {
        if (event.type === 'stage-start') {
          lastStage = event.stage;
          post({ type: 'status', message: `${stageLabels[event.stage]}…` });
          post({ type: 'stage', stage: event.stage });
          if (event.stage === 'submit') display += '\n\nFINAL_ANSWER:';
          else if (event.stage === 'recover') display += '\n\nRecovery working:\n';
        }
        if (event.type === 'token' && event.stage !== 'state') { display += event.text; post({ type: 'token', fullText: display }); }
      } });
    // Wait for cooperative backend cleanup before accepting another request.
    await Promise.allSettled([...pending]);
    const text = result.terminalText && result.terminalText !== result.workingText
      ? `${result.workingText}\n\n${result.terminalText}` : result.workingText || result.text;
    const completed = result.stages.filter((stage) => stage.status === 'completed');
    const seconds = result.stages.reduce((sum, stage) => sum + (stage.measuredSeconds || 0), 0);
    post({ type: 'complete', text, harness: result, warnings: result.warnings,
      tokens: result.status === 'completed' ? completed.reduce((sum, stage) => sum + stage.tokens, 0) : null, seconds,
      stopReason: result.status === 'cancelled' ? 'cancelled' : result.status === 'blocked' ? 'blocked' : result.finishReason,
      checkpoint, runtime, modelLoads: small?.loadCount, lastStage });
  } catch (error) { post({ type: 'error', message: String(error?.message || error) }); }
  finally { await Promise.allSettled([...pending]); activeAbort = null; generationSink = null; busy = false; }
};
