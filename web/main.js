import './style.css';
import { ARCHIVED_MODELS } from './archive-config.js';
import { QWEN4B_MODELS } from './qwen4b-config.js';
import { buildSolverPrompt, checkRestAccelerationDisplacement, inspectSolution, displayFinalAnswer, inspectRecoveryAnswer, MAX_QUESTION_CHARS, suggestSubject } from './harness.js';

const $ = (id) => document.getElementById(id);
let worker;
const selection = () => $('model-choice').value;
const runtimeFor = (choice) => choice.startsWith('4b-') ? '4b' : choice === 'demo' ? 'demo' : 'archive';
const modelName = () => QWEN4B_MODELS[selection()] || ARCHIVED_MODELS[selection()] || 'Qwen3.5 0.8B · separate demo';
let modelReady = false;
let modelLoading = false;
let solving = false;
let selectedFile = null;
let previewUrl = null;
let streamed = '';
let currentAnswerType = 'infer';
let currentQuestion = '';
const fileProgress = new Map();

function state(label, kind = '') {
  $('result-state').textContent = label;
  $('result-state').className = `state-pill ${kind}`;
}
function status(message) { $('model-status').textContent = message; }
function refreshControls() {
  $('load-button').disabled = !navigator.gpu || modelReady || modelLoading || solving;
  $('load-button').textContent = modelReady ? 'Model loaded' : modelLoading ? 'Loading model…' : 'Download and load model';
  $('solve-button').disabled = !modelReady || solving;
  $('model-choice').disabled = modelLoading || solving;
  $('harness-choice').disabled = modelLoading || solving;
  $('cancel-button').disabled = !solving;
  $('stop-button').disabled = !modelLoading && !solving && !modelReady;
}
function showError(message) {
  modelLoading = false;
  solving = false;
  state('Needs attention', 'error');
  status(message);
  $('result-empty').hidden = true;
  $('result-content').hidden = false;
  $('raw-output').textContent = streamed || message;
  refreshControls();
}
function showProgress({ file, loaded, total }) {
  if (!file || !total) return;
  fileProgress.set(file, { loaded, total });
  const percent = Math.min(100, Math.round(loaded / total * 100));
  $('download-track').hidden = false;
  $('download-bar').style.width = `${percent}%`;
  status(`Downloading ${file.split('/').at(-1)} · ${Math.round(loaded / 1e6)} / ${Math.round(total / 1e6)} MB (this file)`);
}

function createWorker() {
worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });
worker.addEventListener('message', ({ data }) => {
  if (data.type === 'status') status(data.message);
  if (data.type === 'progress') showProgress(data);
  if (data.type === 'ready') {
    modelReady = true;
    modelLoading = false;
    $('download-track').hidden = true;
    status(`Ready. ${modelName()} will answer on this device.`);
    if (!solving) state('Ready', 'active');
    refreshControls();
  }
  if (data.type === 'token') {
    streamed = data.fullText ?? (streamed + (data.text || ''));
    $('result-empty').hidden = true;
    $('result-content').hidden = false;
    $('raw-output').textContent = streamed;
    $('raw-output').scrollTop = $('raw-output').scrollHeight;
  }
  if (data.type === 'complete') {
    solving = false;
    $('download-track').hidden = true;
    const raw = data.text || streamed;
    if (typeof data.tokens === 'number') $('output-model').textContent += ` · ${data.tokens} tokens · ${data.seconds.toFixed(1)} s`;
    $('result-content').dataset.modelLoads = String(data.modelLoads ?? '');
    $('raw-output').textContent = raw;
    const check = inspectSolution(raw, currentAnswerType);
    const finalDisplay = displayFinalAnswer(check.final);
    const calculation = checkRestAccelerationDisplacement(currentQuestion, finalDisplay);
    const stopIssue = ['repetition', 'time_limit', 'length', 'cancelled', 'blocked'].includes(data.stopReason) ? [`Generation stopped: ${data.stopReason}. The answer may be incomplete.`] : [];
    const recoveryFormatIssue = data.harness?.routed && data.harness?.terminalText ? inspectRecoveryAnswer(data.harness.terminalText, currentAnswerType) : '';
    const issues = [...(recoveryFormatIssue ? [recoveryFormatIssue] : []), ...(data.warnings || []), ...stopIssue, ...check.issues, ...(calculation?.issue ? [calculation.issue] : [])];
    $('final-card').hidden = !check.final;
    $('final-answer').textContent = finalDisplay;
    $('format-checks').hidden = !issues.length;
    $('format-checks').replaceChildren();
    if (issues.length) {
      const title = document.createElement('strong');
      title.textContent = 'Items to check:';
      const list = document.createElement('ul');
      for (const issue of issues) { const item = document.createElement('li'); item.textContent = issue; list.append(item); }
      $('format-checks').append(title, list);
    }
    const needsReview = !check.formatComplete || issues.length > 0;
    state(needsReview ? 'Review needed' : 'Finished · unverified', needsReview ? 'error' : 'active');
    status(data.harness?.status === 'cancelled' ? 'Stopped. Saved working is unverified. The model is still loaded.' : data.harness?.status === 'blocked' ? 'The selected approach stopped at a limit. Saved working remains available and is unverified.' : calculation?.issue ? 'A narrow independent browser calculation disagrees with the model. Inspect the working.' : `Completed. ${check.formatComplete ? 'The requested sections are present.' : 'Some requested sections are missing.'} Most mathematical steps remain unverified.`);
    refreshControls();
  }
  if (data.type === 'error') showError(data.message);
});
worker.addEventListener('error', (error) => showError(`Model worker failed: ${error.message}`));
}
function resetWorker() {
  worker?.terminate(); createWorker(); modelReady = false; modelLoading = false; solving = false;
  fileProgress.clear(); $('download-track').hidden = true; refreshControls();
}
createWorker();
function describeModel() {
  const kind = runtimeFor(selection());
  $('model-label').textContent = modelName();
  $('model-detail').textContent = kind === '4b' ? 'Text questions. Best used on a desktop with enough memory.' : kind === 'demo' ? 'Smaller download. Accepts text and images.' : 'Larger model. Accepts text and images.';
  $('download-size').textContent = kind === '4b' ? 'Up to 3.1 GB to download. Files can stay in this browser’s cache.' : kind === 'demo' ? 'About 850 MB to download.' : 'Up to 5.7 GB to download. Using an image adds 1.84 GB.';
  $('image').disabled = kind === '4b';
  $('image-guidance').textContent = kind === '4b' ? '4B currently accepts text only. Paste the full question, or choose 9B / 0.8B for an image.' : 'PNG or JPEG · up to 10 MB';
}
$('model-choice').addEventListener('change', () => {
  const next = runtimeFor(selection());
  if (next !== $('model-choice').dataset.runtime) resetWorker();
  $('model-choice').dataset.runtime = next; describeModel();
  status(modelReady ? 'Model selected. The next question uses this version; its model files stay loaded.' : 'Select “Download and load model” to prepare this model.'); refreshControls();
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
$('model-choice').dataset.runtime = runtimeFor(selection()); describeModel();
$('cancel-button').addEventListener('click', () => {
  worker.postMessage({ type: 'cancel' });
  $('cancel-button').disabled = true; status('Stopping generation and keeping the model loaded…');
});
$('stop-button').addEventListener('click', () => {
  resetWorker(); state('Stopped', 'error'); status('Stopped and released model memory. Load the model again to continue; the response remains visible.');
});

function setImage(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  $('image-preview').replaceChildren();
  $('image-preview').hidden = true;
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) { showError('Choose a PNG or JPEG question image.'); $('image').value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { showError('The image exceeds 10 MB. Crop or resize it before retrying.'); $('image').value = ''; return; }
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  const img = document.createElement('img'); img.src = previewUrl; img.alt = 'Attached question';
  const name = document.createElement('span'); name.textContent = file.name;
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove image');
  remove.addEventListener('click', () => { $('image').value = ''; setImage(null); });
  $('image-preview').append(img, name, remove);
  $('image-preview').hidden = false;
}

$('image').addEventListener('change', (event) => setImage(event.target.files?.[0] || null));
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
$('example-button').addEventListener('click', () => {
  $('question').value = 'A particle starts from rest and moves with a constant acceleration of 2 m/s². Find its displacement in the first 3 s.';
  $('subject').value = 'physics'; $('exam').value = 'main'; $('answer-type').value = 'numeric';
  $('question').focus();
});
$('solve-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!modelReady || solving) return;
  const question = $('question').value.trim();
  if (runtimeFor(selection()) === '4b' && selectedFile) return showError('The 4B browser release accepts text only. Remove the image and paste the full question, or select a 9B/0.8B model.');
  if (question.length > MAX_QUESTION_CHARS) return showError(`Keep the question under ${MAX_QUESTION_CHARS} characters.`);
  let prompt;
  try {
    prompt = buildSolverPrompt({ question, hasImage: Boolean(selectedFile), subjectHint: $('subject').value, exam: $('exam').value, answerType: $('answer-type').value });
  } catch (error) { return showError(error.message); }
  currentAnswerType = $('answer-type').value;
  currentQuestion = question;
  $('output-model').textContent = `Output from: ${modelName()} · ${$('harness-choice').selectedOptions[0].textContent}`;
  const classification = suggestSubject(question, $('subject').value);
  const imageBuffer = selectedFile ? await selectedFile.arrayBuffer() : null;
  streamed = '';
  $('raw-output').textContent = '';
  $('final-card').hidden = true;
  $('format-checks').hidden = true;
  $('result-content').hidden = false;
  $('result-empty').hidden = true;
  solving = true;
  state('Solving', 'active');
  status(`Subject: ${classification.subject}. Generating a response in this browser…`);
  refreshControls();
  const responseTypes = { infer: 'unspecified', single: 'single_select', multiple: 'multi_select', numeric: 'numeric' };
  const request = { type: 'solve', checkpoint: selection(), harness: $('harness-choice').value,
    questionContract: { statement: question || '[Question in the attached image]', options: {}, response_type: responseTypes[currentAnswerType], answer_format: {} }, prompt, imageBuffer, imageType: selectedFile?.type, maxNewTokens: Number($('budget').value) };
  worker.postMessage(request, imageBuffer ? [imageBuffer] : []);
});

if (navigator.gpu) status('Browser graphics support detected. Select “Download and load model” to begin.');
else { status('WebGPU not detected. Try current Chrome or Edge on a supported device.'); $('load-button').disabled = true; state('WebGPU needed', 'error'); }
refreshControls();
