# Implemented solver harnesses

A harness is the code that sends a question to a model, controls extra calls and collects its answer. This folder publishes the methods tested with the same Qwen3.5-4B base and step-30 adapter. It contains no model weights, question bank, answer keys or private model outputs.

Start with the [measured comparison](../research/HARNESS_COMPARISON_2026_11_06.md). To use the code, connect your generation runtime to [controller.js](controller.js). The [original local 9B lab](../local_lab/README.md) and [original browser prompt and output checks](../web/harness.js) remain separate implementations. Their results must not be relabeled as measurements of this 4B controller.

## Available methods

| Selector | Implemented behavior after the direct draft |
|---|---|
| `direct` | Return the first response. No follow-up call. |
| `h0` | If the draft stops at its output limit, request one type-specific final submission. |
| `h1` | On that same trigger, continue the literal unfinished assistant text once, then request a final submission. |
| `h2` | On that trigger, request one short task-state record, attempt its task once, then request a final submission. A malformed or reserved state uses H0. |

Every normal non-capped response remains unchanged. The trigger is the runtime's `finishReason: "length"`, not an answer key, confidence judgment or a guessed loop. There is no retry-until-correct loop. Technical interruptions produce a blocked or cancelled result with saved working; they are not recorded as successful repairs.

The measured native direct pass allowed 4,096 output tokens. H1 allows 512 more working tokens plus 96 for submission. H2 allows 96 for the task record, 416 for working and 96 for submission. The two recovery policies therefore share a maximum of 608 additional output tokens, but process different amounts of input and use different numbers of calls. All stages use the same model and adapter, temperature zero and thinking disabled.

H2 accepts exactly three nonempty string fields: `established`, `remaining` and `next_task`. Duplicate keys, extra keys, wrapped JSON and invalid values fail. Each string has a maximum of 400 characters. The instruction asks for at most 16 words per field; that word count is an instruction, not a validator. Exact task values `unreadable` and `submit_supported_result`, ignoring case and surrounding whitespace, also use H0. A parsed state remains an unverified model suggestion.

## Connect a runtime

```js
import { runHarness } from './harnesses/controller.js';

const result = await runHarness({
  mode: 'h1',
  question: {
    statement: 'What is 2 + 3?',
    options: { A: '4', B: '5' },
    response_type: 'single_select',
    answer_format: {},
  },
  generate, // Your already-loaded runtime adapter.
  signal: abortController.signal,
  onEvent(event) { /* Save or display progress. */ },
});
```

The injected `generate` function receives:

```js
{
  stage, userText, assistantPrefix, images,
  maxTokens, deadlineMs, signal, onToken,
  temperature: 0, enableThinking: false
}
```

Render `userText` with the pinned model chat template, then append `assistantPrefix` as literal assistant continuation. Do not turn that prefix into a new user instruction. Return only newly generated text:

```js
{ text: generatedSuffix, tokens: generatedTokenCount,
  finishReason: 'stop' /* or 'length' */, inputTokens, seconds }
```

Call `onToken(deltaText)` with new text only, not the cumulative string. The adapter must enforce `maxTokens`, honor cancellation, and keep the same model and adapter throughout the run. The controller cannot forcibly terminate a GPU kernel; the runtime must stop scheduling work when its signal is aborted. Unsupported stops such as repetition guards or time limits must not be reported as normal length caps.

Progress events are `stage-start`, `token` and `stage-complete`. Results include `harnessId`, `status`, `text`, `workingText`, `terminalText`, `finishReason`, `stages` and `warnings`. `completed` means the bounded policy completed; it does **not** mean the science is correct, the final format is valid or checks passed. Each stage record retains its prompt, prefix, output and limits. Keep user receipts private.

Use source-derived answer types `single_select`, `multi_select` or `numeric`. Numeric rules support `require_integer` and `max_decimal_places`. Hidden fields are not copied into prompts. Images may be supplied separately if the runtime supports them; this controller does not implement vision. Never put answers or review notes into visible question fields.

## Native evidence and portable differences

The exact measured direct, submission, typed-submission, state and recovery instruction text is in [prompts.js](prompts.js). The control flow follows the completed native experiment. [correspondence.json](correspondence.json) records its source identities and the intentional differences below.

The native comparison reused saved direct drafts and saved H0 submissions. H1 and H2 were fresh calls on those drafts. This controller can accept `initialDraft` and `initialH0` receipts. Without them, it creates a fresh direct response; H2 computes an H0 submission only if its state fails. It does not generate an unused H0 answer before every recovery. That live fallback call has a cost and appears in the receipt.

A plain continuation reprocesses the original prompt and decoded draft. It does not resume the original cached decoder state. The targeted policy also keeps the original draft in its inputs. Equal output allowance is not equal total computation.

A string `question` is treated as an existing direct user prompt. An optional `directPrompt` overrides the native direct instruction. String questions use an `unspecified` answer type and an additional generic submission instruction; this is a portable/browser adaptation, **not** a prompt measured in the native 24-question experiment. Prefer the structured contract when the printed answer type is known.

The browser may set a lower `directMaxTokens` and `maxStageMs`, and reject a full prompt that exceeds its input budget. The controller preserves the earlier working after `CONTEXT_LIMIT` or another technical failure and labels the attempt blocked. It never silently truncates a draft. Chat-template, image, precision and runtime differences also prevent treating native scores as browser accuracy.

For the original one-response browser mode only, `directDeadlineMs` may preserve an older runtime's deadline up to 600 seconds. It defaults to the native 300 seconds and cannot override H0/H1/H2. The runtime-wide `maxStageMs` also applies. This avoids shortening an existing 9B direct session merely because the separate 4B browser path uses a tighter limit.

This folder makes no change to answer grading. It retains malformed outputs rather than rewriting them into apparently correct answers. Formatting, scientific correctness and sufficient working require separate assessment. For inspection of the published native scores, [native_answer_normalizer.py](native_answer_normalizer.py) preserves the original key-free submission normalization functions. This offline reference is not a new browser repair step. Its historical limits include single-line JSON handling and simple decimal extraction; it is not a general mathematics parser or scientific checker.

## CLI and checks

The CLI accepts a caller-provided adapter module exporting `generate`. It does not configure a network service or download a model:

```sh
node harnesses/cli.js h1 question.json ./generation-adapter.mjs ./runs/attempt.json
node --test harnesses/tests/*.test.js
python3 -m unittest discover -s harnesses/tests -p 'test_*.py'
```

The CLI saves incremental progress and a final structured receipt with atomic file replacement. This is a local progress record, not an off-device backup or a resume of decoder state. Ctrl-C requests cancellation. The tests use deterministic synthetic adapters; they verify orchestration and failure handling, not JEE accuracy or a real runtime's speed.
