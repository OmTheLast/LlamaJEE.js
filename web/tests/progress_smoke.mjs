import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Exercise the actual solver page with deterministic worker messages and no model download.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--disable-gpu'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!navigator.gpu) Object.defineProperty(navigator, 'gpu', { value: {} });
    window.Worker = class extends EventTarget {
      constructor() { super(); window.testWorker = this; }
      postMessage({ type }) {
        if (type === 'load') this.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' } }));
        if (type === 'cancel') window.cancelRequested = true;
      }
      terminate() {}
    };
  });
  await page.goto(process.env.JEE_BROWSER_URL || 'http://127.0.0.1:5173/');
  const send = data => page.evaluate(message => {
    window.testWorker.dispatchEvent(new MessageEvent('message', { data: message }));
  }, data);
  const progress = (stage, phase, processed, total) => send({ type: 'solve-progress', stage, phase, processed, total });
  const selector = id => page.locator('#' + id);
  // The chat composer clears after each question, so later questions are typed again.
  const typeQuestion = () => selector('question').fill('A particle starts from rest with acceleration 2 m/s². Find its displacement in 3 s.');
  await selector('load-button').click();
  await selector('example-button').click();
  await selector('solve-button').click();
  await progress('direct', 'reading', 4, 12);
  assert.equal(await selector('solve-phase').innerText(), 'Reading the question');
  assert.equal(await selector('model-status').innerText(), 'Reading the question…');
  assert.equal(await selector('solve-count').innerText(), '4 of 12 input tokens');
  assert.ok(await selector('reading-progress').isVisible());

  const interrupted = (errorCode, interruptedStage, extras = {}) => ({
    type: 'complete', text: '', seconds: 120, stopReason: 'blocked',
    harness: { status: 'blocked', interruptedStage, errorCode, stages: [] }, ...extras,
  });
  await send(interrupted('STALL_TIMEOUT', 'direct', { draining: true }));
  assert.match(await selector('format-checks').innerText(), /stopped making progress while reading the question/);
  assert.match(await selector('format-checks').innerText(), /No answer text was returned/);
  assert.doesNotMatch(await selector('format-checks').innerText(), /FINAL_ANSWER|decomposition|consistency check/);
  assert.ok(await selector('working-label').isHidden());
  assert.ok(await selector('solve-progress').isHidden());
  assert.ok(await selector('solve-button').isDisabled());
  assert.ok(await selector('stop-button').isEnabled());
  await send({ type: 'drain-complete' });
  await typeQuestion();
  assert.ok(await selector('solve-button').isEnabled());

  await selector('solve-button').click();
  await progress('direct', 'writing', 2, 768);
  assert.equal(await selector('solve-phase').innerText(), 'Writing the answer');
  assert.ok(await selector('reading-progress').isHidden());
  assert.match(await selector('solve-count').innerText(), /2 tokens written/);
  await send({ type: 'token', fullText: 'Work up to the output limit' });
  await progress('submit', 'reading', 0, 24);
  assert.equal(await selector('solve-phase').innerText(), 'Reading the draft for a final answer');
  await progress('submit', 'writing', 4, 96);
  assert.equal(await selector('solve-phase').innerText(), 'Writing the final answer');
  const partial = 'Work up to the output limit\n\nFINAL_ANSWER: {"type":"numeric"';
  await send({ type: 'token', fullText: partial });
  await send(interrupted('HARD_TIMEOUT', 'submit', { text: 'Work up to the output limit' }));
  assert.match(await selector('format-checks').innerText(), /maximum time while writing the final answer/);
  assert.equal(await selector('raw-output').textContent(), partial);
  assert.ok(await selector('final-card').isHidden());
  assert.equal(await selector('working-label').textContent(), 'Partial working · unverified');

  await typeQuestion();
  await selector('solve-button').click();
  await selector('cancel-button').click();
  assert.ok(await page.evaluate(() => window.cancelRequested));
  await send({ type: 'complete', text: '', seconds: 2, harness: { status: 'cancelled' } });
  assert.match(await selector('format-checks').innerText(), /You stopped generation/);
  await typeQuestion();
  assert.ok(await selector('solve-button').isEnabled());

  await selector('solve-button').click();
  await progress('direct', 'writing', 1, 768);
  await send({ type: 'complete', text: 'PLAN: Use acceleration.\nWORK: 0.5 × 2 × 3².\nCHECK: Units are metres.\nFINAL_ANSWER: 9 m',
    tokens: 32, seconds: 3.1, stopReason: 'stop', harness: { status: 'completed' } });
  assert.equal(await selector('final-answer').textContent(), '9 m');
  assert.ok(await selector('final-card').isVisible());
  assert.ok(await selector('format-checks').isHidden());
  assert.ok(await selector('solve-progress').isHidden());
  assert.deepEqual(errors, []);
  console.log('Passed: reading, writing, second-stage progress, empty stall, cleanup/reuse, partial hard stop, cancellation and completed answer.');
} finally {
  await browser.close();
}
