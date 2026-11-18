import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBrowserSubmission } from '../recovery-prompt.js';
import { runHarness, contractJSON, visibleQuestion } from '../../harnesses/controller.js';
import { inspectRecoveryAnswer, displayFinalAnswer } from '../harness.js';

const question = { statement: 'Pick the positive solution of x² = 9. Explain any restriction.',
  options: { A: '-3', B: '3' }, response_type: 'single_select', answer_format: {} };
// Counts full rendered input, including template and literal assistant prefix.
const countInputTokens = text => [...'<user>' + text + '</user><assistant>FINAL_ANSWER:'].length;

test('a submission that fits retains the complete question, draft and output schema', () => {
  const draft = 'x = ±3. Positive means x > 0. Choose B.';
  const full = prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens: 2000 });
  const exact = prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens: countInputTokens(full.userText) });
  assert.equal(exact.userText, full.userText);
  assert.ok(exact.userText.endsWith(draft));
  assert.ok(exact.userText.includes(contractJSON(visibleQuestion(question))));
  assert.match(exact.userText, /one printed option label/);
  assert.equal(exact.promptBudget.omittedDraftCharacters, 0);
  assert.equal(exact.promptBudget.inputTokens, exact.promptBudget.maxInputTokens);
});

test('oversized draft preserves question and draft ends, labels its omission and remeasures Unicode', () => {
  const draft = 'Use x > 0.\n' + 'Calculation α😀 = 3.\n'.repeat(180) + '\nThus x = 3, option B.';
  const fitted = prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens: 1100 });
  assert.ok(fitted.promptBudget.inputTokens <= 1100);
  assert.equal(fitted.promptBudget.inputTokens, countInputTokens(fitted.userText));
  assert.ok(fitted.userText.includes(contractJSON(visibleQuestion(question))));
  assert.ok(fitted.userText.includes('Use x > 0.'));
  assert.ok(fitted.userText.endsWith('Thus x = 3, option B.'));
  assert.match(fitted.userText, /Middle of the draft omitted/);
  assert.doesNotMatch(fitted.userText, /\uFFFD/);
  assert.ok(fitted.promptBudget.omittedDraftCharacters > 0);
  assert.equal(fitted.promptBudget.draftCharacters, [...draft].length);
});

test('H0 sends the fitted prompt, saves its accounting and preserves full working', async () => {
  const draft = 'x > 0.\n' + 'Calculate.\n'.repeat(300) + 'x = 3, option B.';
  const events = [];
  const result = await runHarness({ mode: 'h0', question,
    initialDraft: { text: draft, tokens: 1280, finishReason: 'length' }, directMaxTokens: 1280,
    prepareSubmission: ({ question, draft }) => prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens: 1100 }),
    onEvent: event => events.push(event),
    generate: async request => {
      assert.equal(request.stage, 'submit');
      assert.ok(countInputTokens(request.userText) <= 1100);
      assert.equal(request.assistantPrefix, 'FINAL_ANSWER:');
      assert.equal(request.maxTokens, 96);
      return { text: '{"type":"options","selected_options":["B"]}', tokens: 15, finishReason: 'stop' };
    },
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.workingText, draft);
  assert.match(result.warnings.join(' '), /shortened copy/);
  assert.deepEqual(events.find(e => e.type === 'stage-complete').receipt.promptBudget, result.stages[0].promptBudget);
  assert.equal(result.stages[0].promptBudget.policy, 'browser-submission-v1');
});

test('an oversized question blocks submission without dropping its terms or losing the draft', async () => {
  const draft = 'Saved work';
  const result = await runHarness({ mode: 'h0', question: { ...question, statement: question.statement.repeat(100) },
    initialDraft: { text: draft, tokens: 1280, finishReason: 'length' }, directMaxTokens: 1280,
    prepareSubmission: ({ question, draft }) => prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens: 1100 }),
    generate: async () => assert.fail('No model call should run with an oversized question'),
  });
  assert.equal(result.errorCode, 'CONTEXT_LIMIT');
  assert.equal(result.interruptedStage, 'submit');
  assert.equal(result.workingText, draft);
  assert.equal(result.stages[0].preparationFailed, true);
});

test('written answers are accepted for inferred questions and explicit answer formats stay strict', () => {
  const answer = '{"type":"text","value":"x = 3 with x > 0"}';
  assert.equal(displayFinalAnswer(answer), 'x = 3 with x > 0');
  assert.equal(inspectRecoveryAnswer('FINAL_ANSWER: ' + answer, 'infer'), '');
  for (const type of ['numeric', 'single', 'multiple']) assert.match(inspectRecoveryAnswer(answer, type), /expected answer format/);
  assert.match(inspectRecoveryAnswer('{"type":"text","value":" "}', 'infer'), /expected answer format/);
  assert.match(inspectRecoveryAnswer('{"type":"text","value":3}', 'infer'), /expected answer format/);
  assert.match(inspectRecoveryAnswer('{"type":"text","value":"3","extra":true}', 'infer'), /expected answer format/);
});
