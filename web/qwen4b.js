import * as ort from 'onnxruntime-web/webgpu';
import { PreTrainedTokenizer } from '@huggingface/transformers';
import { rotaryAt, repeatingTail } from './original9b-math.js';
import { QWEN4B_REVISION, STEP30_SHA256 } from './qwen4b-config.js';

const zero = (dims) => new ort.Tensor('float32', new Float32Array(dims.reduce((a, b) => a * b, 1)), dims);
const pad = (n) => String(n).padStart(2, '0');
const errorWithCode = (message, code) => Object.assign(new Error(message), { code });

// The complete pinned 4B decoder runs here. The web server only serves static files.
export class Qwen4B {
  constructor(root, notify = () => {}) {
    this.root = root.endsWith('/') ? root : root + '/';
    this.notify = notify;
    this.layers = []; this.heads = []; this.embeddings = new Map(); this.factors = new Map();
    this.loadCount = 0; this.callCount = 0; this.checkpoint = 'step30';
    this.maxInputTokens = 1536;
  }
  status(message) { this.notify({ type: 'status', message }); }
  async bytes(name, signal) {
    signal?.throwIfAborted();
    const url = new URL(name, new URL(this.root, self.location.href)).href;
    const expected = this.manifest?.artifacts?.[name]?.bytes;
    let cache;
    try { cache = await caches.open('llamajee-qwen4b-v1'); } catch { /* Model storage is optional. */ }
    const cached = cache && await cache.match(url);
    if (cached) {
      const data = await cached.arrayBuffer();
      signal?.throwIfAborted();
      if (!expected || data.byteLength === expected) return data;
      await cache.delete(url);
    }
    signal?.throwIfAborted();
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Model file ${name}: HTTP ${response.status}.`);
    const saving = cache ? cache.put(url, response.clone()).catch(() => {}) : Promise.resolve();
    const total = expected || Number(response.headers.get('content-length')) || 0;
    let loaded = 0, previous = 0;
    const reader = response.body.getReader(), notify = this.notify;
    const body = new ReadableStream({ async pull(controller) {
      const next = await reader.read();
      if (next.done) { controller.close(); return; }
      loaded += next.value.byteLength;
      if (performance.now() - previous > 500) { notify({ type: 'progress', file: name, loaded, total }); previous = performance.now(); }
      controller.enqueue(next.value);
    } });
    const data = await new Response(body).arrayBuffer();
    await saving;
    signal?.throwIfAborted();
    if (expected && data.byteLength !== expected) throw new Error(`Incomplete model file: ${name}. Reload the model.`);
    this.notify({ type: 'progress', file: name, loaded: data.byteLength, total: total || data.byteLength });
    return data;
  }
  async json(name) { return JSON.parse(new TextDecoder().decode(await this.bytes(name))); }
  async load() {
    if (this.layers.length === 32 && this.heads.length === 16) return;
    if (!self.navigator?.gpu) throw new Error('This 4B model requires WebGPU. Try current Chrome or Edge.');
    this.status('Loading the 4B tokenizer and model files…');
    this.manifest = await this.json('manifest.json');
    if (this.manifest.config.hidden_size !== 2560 || this.manifest.revision !== QWEN4B_REVISION ||
        this.manifest.source_adapter_sha256 !== STEP30_SHA256) throw new Error('The 4B package identity does not match this release.');
    const tokenizerConfig = await this.json('tokenizer_config.json');
    tokenizerConfig.chat_template = new TextDecoder().decode(await this.bytes('chat_template.jinja'));
    this.tokenizer = new PreTrainedTokenizer(await this.json('tokenizer.json'), tokenizerConfig);
    try {
      for (let i = 0; i < 32; i++) {
        this.status(`Loading 4B decoder block ${i + 1} / 32…`);
        this.layers.push(await ort.InferenceSession.create(await this.bytes(`layer-${pad(i)}.onnx`), { executionProviders: ['webgpu'] }));
      }
      for (let i = 0; i < 16; i++) {
        this.status(`Loading 4B output shard ${i + 1} / 16…`);
        this.heads.push(await ort.InferenceSession.create(await this.bytes(`head-${pad(i)}.onnx`), { executionProviders: ['webgpu'] }));
      }
      this.loadCount++;
      this.notify({ type: 'runtime', runtime: '4b', modelLoads: this.loadCount });
    } catch (error) { await this.dispose(); throw error; }
  }
  async adapter(mode, signal) {
    signal?.throwIfAborted();
    if (this.factors.has(mode)) return this.factors.get(mode);
    if (!['base', 'step30'].includes(mode)) throw new Error('Unknown 4B checkpoint.');
    const factors = Array.from({ length: 32 }, () => ({}));
    let nonzeroArrays = 0;
    for (const i of [29, 30, 31]) for (const [name, dims] of Object.entries(this.manifest.adapter_input_shapes)) {
      const meta = this.manifest.adapters.step30.layers[i][name];
      if (JSON.stringify(meta.dims) !== JSON.stringify(dims)) throw new Error('Unexpected adapter dimensions.');
      if (mode === 'base') factors[i][name] = zero(dims);
      else {
        const bytes = await this.bytes(meta.file, signal);
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
        if (digest !== this.manifest.artifacts[meta.file]?.sha256) throw new Error('Adapter integrity check failed. Reload the model.');
        const values = new Float32Array(bytes);
        if (!values.every(Number.isFinite)) throw new Error('Invalid adapter values.');
        if (values.some((v) => v !== 0)) nonzeroArrays++;
        factors[i][name] = new ort.Tensor('float32', values, dims);
      }
    }
    factors.binding = { checkpoint: mode, arrays: 18, nonzeroArrays, sourceAdapterSha256: mode === 'step30' ? STEP30_SHA256 : null };
    this.factors.set(mode, factors);
    this.notify({ type: 'adapter', ...factors.binding });
    return factors;
  }
  async embedding(id, signal) {
    signal?.throwIfAborted();
    const width = 2560, rows = this.manifest.embedding_rows_per_shard;
    const chunk = Math.floor(id / rows), row = id % rows;
    if (!this.embeddings.has(chunk)) this.embeddings.set(chunk, [
      new Uint32Array(await this.bytes(`embed-${pad(chunk)}.u32`, signal)),
      new Float32Array(await this.bytes(`embed-${pad(chunk)}.scales.f32`, signal)),
      new Float32Array(await this.bytes(`embed-${pad(chunk)}.biases.f32`, signal)),
    ]);
    const [packed, scales, biases] = this.embeddings.get(chunk), values = new Float32Array(width);
    for (let j = 0; j < width; j++) {
      const group = row * (width / 64) + (j >>> 6);
      values[j] = ((packed[row * (width / 8) + (j >>> 3)] >>> (4 * (j & 7))) & 15) * scales[group] + biases[group];
    }
    return values;
  }
  prepare(userText, assistantPrefix = '') {
    const chat = this.tokenizer.apply_chat_template([{ role: 'user', content: [{ type: 'text', text: userText }] }],
      { tokenize: false, add_generation_prompt: true, enable_thinking: false });
    // A literal assistant prefix continues the same response, not a new user turn.
    const ids = this.tokenizer(chat + assistantPrefix, { add_special_tokens: false }).input_ids.tolist()[0].map(Number);
    if (ids.length > this.maxInputTokens) throw errorWithCode(
      `This browser release allows ${this.maxInputTokens.toLocaleString()} input tokens per stage; this request needs ${ids.length.toLocaleString()}. Nothing was truncated. Shorten the question or use the original approach without recovery.`, 'CONTEXT_LIMIT');
    return ids;
  }
  async generate({ userText, assistantPrefix = '', maxTokens = 768, deadlineMs = 120000, signal, onToken = () => {} }) {
    await this.load();
    const inputIds = this.prepare(userText, assistantPrefix), ids = [...inputIds], plen = ids.length;
    const adapters = await this.adapter(this.checkpoint, signal), cfg = this.manifest.config;
    const states = cfg.layer_types.map((kind) => kind === 'linear_attention'
      ? [zero([1, 8192, 4]), zero([1, 32, 128, 128])] : [zero([1, 4, 0, 256]), zero([1, 4, 0, 256])]);
    const generatedIds = [], start = performance.now(), timeLimit = Math.min(120000, deadlineMs);
    maxTokens = Math.min(1280, Math.max(1, maxTokens));
    let hidden = null, finishReason = 'length', text = '', processedInputTokens = 0, firstTokenScore = null;
    this.callCount++;
    const stopRequested = () => signal?.aborted ? 'cancelled' : performance.now() - start >= timeLimit ? 'time_limit' : null;
    try {
      tokens: for (let pos = 0; pos < ids.length; pos++) {
        if (stopRequested()) { finishReason = stopRequested(); break; }
        const vector = await this.embedding(ids[pos], signal), rotary = rotaryAt([pos, pos, pos]);
        const cos = new ort.Tensor('float32', rotary.cos, [1, 1, 64]), sin = new ort.Tensor('float32', rotary.sin, [1, 1, 64]);
        hidden = new ort.Tensor('float32', vector, [1, 1, 2560]);
        try {
          for (let i = 0; i < 32; i++) {
            if (stopRequested()) { finishReason = stopRequested(); break tokens; }
            const recurrent = cfg.layer_types[i] === 'linear_attention';
            const out = await this.layers[i].run({ hidden, ...adapters[i], ...(recurrent
              ? { conv: states[i][0], state: states[i][1] } : { key: states[i][0], value: states[i][1], cos, sin }) });
            hidden.dispose(); states[i].forEach((tensor) => tensor.dispose());
            hidden = out.hidden_out;
            states[i] = recurrent ? [out.conv_out, out.state_out] : [out.key_out, out.value_out];
          }
          if (pos < plen) processedInputTokens++;
          if (pos >= plen - 1) {
            let best = -Infinity, id = 0;
            for (let i = 0; i < 16; i++) {
              if (stopRequested()) { finishReason = stopRequested(); break tokens; }
              const out = await this.heads[i].run({ hidden }), logits = await out.logits.getData();
              for (let j = 0; j < logits.length; j++) if (logits[j] > best) { best = logits[j]; id = i * this.manifest.head_rows_per_shard + j; }
              out.logits.dispose();
            }
            if (!Number.isFinite(best)) throw new Error('The device returned invalid model scores. Release and reload the model.');
            if (firstTokenScore === null) firstTokenScore = { id, logit: best };
            generatedIds.push(id); text = this.tokenizer.decode(generatedIds, { skip_special_tokens: true });
            await onToken(text);
            if ([248044, 248046].includes(id)) { finishReason = 'stop'; break; }
            if (repeatingTail(generatedIds)) { finishReason = 'repetition'; break; }
            if (generatedIds.length >= maxTokens) break;
            ids.push(id);
          } else if (pos % 10 === 0) this.status(`Reading this stage: ${pos + 1} / ${plen} input tokens…`);
        } finally { hidden?.dispose(); hidden = null; cos.dispose(); sin.dispose(); }
      }
      return { text, finishReason, stopReason: finishReason, tokens: generatedIds.length, generatedIds,
        inputTokens: plen, processedInputTokens, seconds: (performance.now() - start) / 1000,
        checkpoint: this.checkpoint, adapterBinding: adapters.binding, firstTokenScore, modelLoads: this.loadCount, callCount: this.callCount };
    } finally { hidden?.dispose(); for (const pair of states) pair.forEach((tensor) => tensor.dispose()); }
  }
  async dispose() {
    for (const session of [...this.layers, ...this.heads]) await session.release();
    this.layers = []; this.heads = [];
    for (const groups of this.factors.values()) for (const group of groups) Object.values(group).forEach((tensor) => tensor.dispose());
    this.factors.clear(); this.embeddings.clear();
  }
}
