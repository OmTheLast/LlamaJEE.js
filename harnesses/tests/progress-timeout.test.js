import assert from 'node:assert/strict';
import test from 'node:test';
import { runHarness } from '../controller.js';

const question = 'Give the equation of a line.';
const progressTimeout = { idleMs: 120000 };
const done = { text: 'FINAL_ANSWER: y = x', tokens: 1, finishReason: 'stop' };
function simulatedTime(t) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return (ms, deliverTimers = true) => {
    now += ms;
    if (deliverTimers) t.mock.timers.tick(ms);
  };
}

test('4B continues reading and writing past both old stage deadlines; H0 submits after a real token cap', async t => {
  const advance = simulatedTime(t);
  const stages = [];
  const generate = ({ stage, onProgress, maxTokens, signal }) => {
    stages.push(stage);
    onProgress({ phase: 'reading', processed: 0, total: 2 });
    advance(90000);
    onProgress({ phase: 'reading', processed: 1, total: 2 });
    advance(90000);
    onProgress({ phase: 'reading', processed: 2, total: 2 });
    onProgress({ phase: 'writing', processed: 0, total: maxTokens });
    advance(90000);
    onProgress({ phase: 'writing', processed: 1, total: maxTokens });
    assert.equal(signal.aborted, false);
    return stage === 'direct' ? { text: 'solving', tokens: 1, finishReason: 'length' } : done;
  };
  const result = await runHarness({ question, mode:'h0', directMaxTokens:1, generate, progressTimeout });
  assert.equal(result.status, 'completed');
  assert.deepEqual(stages, ['direct','submit']);
  assert.equal(result.stages[1].deadlineMs, null);
  assert.equal(result.stages[1].progress.phase, 'writing');
});

test('duplicate, invalid, regressing and phase-only announcements cannot renew an idle stage', async t => {
  const advance = simulatedTime(t);
  const result = await runHarness({ question, progressTimeout, generate: ({ onProgress, signal }) => {
    onProgress({ phase: 'reading', processed: 1, total: 2 });
    advance(60000);
    onProgress({ phase: 'reading', processed: 1, total: 2 });
    onProgress({ phase: 'reading', processed: 0, total: 2 });
    onProgress({ phase: 'reading', processed: 3, total: 2 });
    onProgress({ phase: 'reading', processed: 2, total: 4 });
    onProgress({ phase: 'writing', processed: 0, total: 96 });
    onProgress({ phase: 'reading', processed: 2, total: 2 });
    advance(60001);
    assert.equal(signal.aborted, true);
    return done;
  } });
  assert.equal(result.errorCode, 'STALL_TIMEOUT');
  assert.equal(result.stages.length, 1);
  assert.equal(result.terminalText, '');
});

test('after a delayed timer, late progress cannot restart an expired stall', async t => {
  const advance = simulatedTime(t);
  const result = await runHarness({ question, progressTimeout, generate: ({ onProgress, onToken, signal }) => {
    onProgress({ phase: 'writing', processed: 1, total: 2 });
    onToken('Partial answer');
    advance(150000, false);
    onProgress({ phase: 'writing', processed: 2, total: 2 });
    onToken('late output');
    assert.equal(signal.aborted, true);
    return done;
  } });
  assert.equal(result.errorCode, 'STALL_TIMEOUT');
  assert.equal(result.workingText, 'Partial answer');
  assert.equal(result.stages[0].progress.processed, 1);
});

test('a caller may still request an explicit ceiling on a progress-tracked stage', async t => {
  const advance = simulatedTime(t);
  const result = await runHarness({ question, progressTimeout, maxStageMs:1800000, generate: ({ onProgress, signal }) => {
    for (let i = 1; i <= 30; i++) {
      advance(60000);
      onProgress({ phase:'reading', processed:i, total:31 });
    }
    assert.equal(signal.aborted, true);
    return done;
  } });
  assert.equal(result.errorCode, 'HARD_TIMEOUT');
  assert.equal(result.stages.length, 1);
});

test('cancelling during progress returns immediately even while the backend is unwinding', async () => {
  const user = new AbortController();
  let finish;
  const backend = new Promise(resolve => { finish = resolve; });
  const result = await runHarness({ question, progressTimeout, signal:user.signal, generate: ({ onProgress, onToken }) => {
    onProgress({ phase:'writing', processed:1, total:2 });
    onToken('Partial');
    user.abort();
    return backend;
  } });
  assert.equal(result.status, 'cancelled');
  assert.equal(result.workingText, 'Partial');
  finish(done);
});

test('idle-only 4B stages can progress beyond thirty minutes and still stop on a genuine stall', async t => {
  const advance = simulatedTime(t);
  let resolveBackend;
  const backend = new Promise(resolve => { resolveBackend = resolve; });
  const result = await runHarness({ question, progressTimeout, generate: ({ onProgress, onToken, signal, deadlineMs }) => {
    assert.equal(deadlineMs, null);
    for (let n = 1; n <= 35; n++) {
      advance(60000);
      onProgress({ phase:'reading', processed:n, total:35 });
      assert.equal(signal.aborted, false);
    }
    onProgress({ phase:'writing', processed:1, total:2 });
    onToken('Partial');
    advance(120001);
    assert.equal(signal.aborted, true);
    return backend;
  } });
  assert.equal(result.errorCode, 'STALL_TIMEOUT');
  assert.equal(result.stages[0].deadlineMs, null);
  assert.equal(result.stages[0].progress.phase, 'writing');
  assert.equal(result.workingText, 'Partial');
  resolveBackend(done);
});
