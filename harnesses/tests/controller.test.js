import test from 'node:test';
import assert from 'node:assert/strict';
import { runHarness, parseTaskState, makePrompts, visibleQuestion, BUDGETS } from '../controller.js';

const question = { statement: 'What is 2 + 3?', options: { A: '4', B: '5' }, response_type: 'single_select', answer_format: {} };
const draft = { text: '2 + 3 = ', tokens: 8, finishReason: 'length' };
const state = JSON.stringify({ established: 'Addition is required', remaining: 'Finish the sum', next_task: 'Add the two numbers' });
function adapter(outputs) {
  const calls = [];
  const generate = async call => {
    calls.push(call);
    const value = outputs[calls.length - 1];
    if (value instanceof Error) throw value;
    assert.ok(value, 'No unexpected generation call');
    call.onToken(value.text);
    return { tokens: 4, finishReason: 'stop', ...value };
  };
  return { calls, generate };
}

test('a non-capped answer remains exactly unchanged in every recovery policy', async () => {
  for (const mode of ['direct', 'h0', 'h1', 'h2']) {
    const a = adapter([{ text: 'FINAL_ANSWER:{"type":"numeric","value":"5"}' }]);
    const result = await runHarness({ mode, question, generate: a.generate });
    assert.equal(a.calls.length, 1); assert.equal(result.routed, false);
    assert.equal(result.text, 'FINAL_ANSWER:{"type":"numeric","value":"5"}');
  }
});

test('H0 uses a typed submission only after an actual length cap', async () => {
  const a = adapter([draft, { text: '{"type":"options","selected_options":["B"]}' }]);
  const r = await runHarness({ mode: 'h0', question, generate: a.generate });
  assert.deepEqual(a.calls.map(c => c.stage), ['direct', 'submit']);
  assert.equal(a.calls[1].maxTokens, 96); assert.equal(a.calls[1].assistantPrefix, 'FINAL_ANSWER:');
  assert.match(a.calls[1].userText, /one printed option label/);
  assert.equal(r.text, 'FINAL_ANSWER:{"type":"options","selected_options":["B"]}');
});

test('H1 continues the literal assistant prefix once with fixed budgets', async () => {
  const a = adapter([{ text: '5.', tokens: 512, finishReason: 'length' }, { text: '{"type":"options","selected_options":["B"]}' }]);
  const r = await runHarness({ mode: 'h1', question, generate: a.generate, initialDraft: draft });
  assert.deepEqual(a.calls.map(c => [c.stage, c.maxTokens]), [['plain', 512], ['submit', 96]]);
  assert.equal(a.calls[0].userText, makePrompts(question).direct);
  assert.equal(a.calls[0].assistantPrefix, draft.text);
  assert.equal(r.workingText, draft.text + '5.');
  assert.equal(r.stages.length, 2); assert.equal(r.status, 'completed');
});

test('H2 makes one state, one recovery and one submission with equal maximum output allowance', async () => {
  const a = adapter([{ text: state }, { text: 'The sum is 5; choose B.' }, { text: '{"type":"options","selected_options":["B"]}' }]);
  const r = await runHarness({ mode: 'h2', question, generate: a.generate, initialDraft: draft });
  assert.deepEqual(a.calls.map(c => [c.stage, c.maxTokens]), [['state', 96], ['recover', 416], ['submit', 96]]);
  assert.equal(BUDGETS.plain + BUDGETS.submit, BUDGETS.state + BUDGETS.recover + BUDGETS.submit);
  assert.match(a.calls[1].userText, /PROPOSED TASK STATE \(UNVERIFIED\)/);
  assert.match(a.calls[2].userText, /RECOVERY ATTEMPT:/);
  assert.equal(r.fallback, false);
});

test('malformed, duplicate-key and reserved states use H0 without a recovery call', async () => {
  for (const text of ['{"established":"x"', '{"established":"x","established":"y","remaining":"z","next_task":"n"}',
    JSON.stringify({ established: 'x', remaining: 'y', next_task: 'submit_supported_result' }),
    JSON.stringify({ established: 'x', remaining: 'y', next_task: 'unreadable' })]) {
    const a = adapter([{ text }, { text: '{"type":"abstain"}' }]);
    const r = await runHarness({ mode: 'h2', question, generate: a.generate, initialDraft: draft });
    assert.deepEqual(a.calls.map(c => c.stage), ['state', 'submit']);
    assert.equal(r.fallback, true); assert.match(r.warnings[0], /not a successful recovery/);
    assert.ok(!a.calls[1].userText.includes('RECOVERY ATTEMPT:'));
  }
});

test('saved H0 fallback is reused byte-for-byte, never chosen by correctness', async () => {
  const initialH0 = { text: 'FINAL_ANSWER:{"type":"abstain"}', tokens: 6, finishReason: 'stop' };
  const a = adapter([{ text: 'not JSON' }]);
  const r = await runHarness({ mode: 'h2', question, generate: a.generate, initialDraft: draft, initialH0 });
  assert.equal(a.calls.length, 1); assert.equal(r.text, initialH0.text);
});

test('strict state parser rejects extra fields, nonstrings and duplicate keys', () => {
  assert.equal(parseTaskState('```json\n' + state + '\n```'), null);
  assert.equal(parseTaskState('{"established":"x","remaining":"y","next_task":null}'), null);
  assert.equal(parseTaskState('{"established":"x","remaining":"y","next_task":"z","answer":"5"}'), null);
  assert.deepEqual(parseTaskState(state), JSON.parse(state));
  assert.ok(parseTaskState(JSON.stringify({ established: 'He said "x": y', remaining: 'r', next_task: 'n' })));
});

test('visible input excludes grades, answers, hidden metadata and assets', () => {
  const q = { ...question, answer_key: 'DO_NOT_SEND', assets: ['/private/file'], review: 'DO_NOT_SEND', answer_format: { require_integer: true, answer_key: 'DO_NOT_SEND' } };
  assert.ok(!JSON.stringify(visibleQuestion(q)).includes('DO_NOT_SEND'));
  assert.ok(!makePrompts(q).direct.includes('/private/'));
});

test('context rejection preserves the draft and is not a successful fallback', async () => {
  const error = Object.assign(new Error('Input exceeds the browser budget.'), { code: 'CONTEXT_LIMIT' });
  const a = adapter([error]);
  const r = await runHarness({ mode: 'h1', question, generate: a.generate, initialDraft: draft });
  assert.equal(r.status, 'blocked'); assert.equal(r.text, draft.text); assert.equal(r.terminalText, '');
  assert.equal(r.errorCode, 'CONTEXT_LIMIT'); assert.equal(a.calls.length, 1);
});

test('user cancellation stops further stages and retains streamed output', async () => {
  const controller = new AbortController(); let calls = 0;
  const generate = async ({ onToken, signal }) => {
    calls++; onToken('Partial direct work'); controller.abort();
    await new Promise((resolve, reject) => {
      if (signal.aborted) reject(Object.assign(new Error('cancelled'), { code: 'ABORTED' }));
      else signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });
  };
  const r = await runHarness({ mode: 'h2', question, generate, signal: controller.signal });
  assert.equal(r.status, 'cancelled'); assert.equal(calls, 1); assert.equal(r.workingText, 'Partial direct work');
});

test('deadline aborts the adapter, preserves prior work and never proceeds', async () => {
  let aborted = false, calls = 0;
  const generate = ({ signal }) => new Promise((resolve, reject) => {
    calls++; signal.addEventListener('abort', () => { aborted = true; reject(new Error('deadline')); }, { once: true });
  });
  const r = await runHarness({ mode: 'h1', question, generate, initialDraft: draft, maxStageMs: 5 });
  assert.equal(r.status, 'blocked'); assert.equal(r.errorCode, 'DEADLINE');
  assert.equal(r.text, draft.text); assert.equal(aborted, true); assert.equal(calls, 1);
});

test('over-budget generated output cannot be recorded as a completed stage', async () => {
  const a = adapter([{ text: 'bad', tokens: 513 }]);
  const r = await runHarness({ mode: 'h1', question, generate: a.generate, initialDraft: draft });
  assert.equal(r.status, 'blocked'); assert.equal(r.stages[0].status, 'interrupted'); assert.equal(a.calls.length, 1);
});

test('repetition and time stops are never mistaken for recoverable length caps', async () => {
  for (const reason of ['repetition', 'time_limit', 'cancelled']) {
    const a = adapter([{ text: 'Partial working', finishReason: reason }]);
    const r = await runHarness({ mode: 'h2', question, generate: a.generate });
    assert.equal(a.calls.length, 1); assert.equal(r.workingText, 'Partial working');
    assert.equal(r.status, reason === 'cancelled' ? 'cancelled' : 'blocked');
  }
});

test('legacy direct-only deadline can be preserved without changing recovery defaults', async () => {
  const a = adapter([{ text: 'Done.' }]);
  await runHarness({ mode: 'direct', question, generate: a.generate, directDeadlineMs: 600000, maxStageMs: 600000 });
  assert.equal(a.calls[0].deadlineMs, 600000);
  await assert.rejects(runHarness({ mode: 'h1', question, generate: a.generate, directDeadlineMs: 600000 }), /only available in direct mode/);
  await assert.rejects(runHarness({ mode: 'direct', question, generate: a.generate, directDeadlineMs: 600001 }), /at most 600000/);
});
