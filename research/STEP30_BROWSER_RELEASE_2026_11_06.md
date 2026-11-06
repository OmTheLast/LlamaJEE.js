# 4B step-30 release and browser checks

6 November 2026. **The actual step-30 adapter and browser package are public, and model execution on the public website is verified. On one elementary physics question, the normal 768-token setting answered correctly; a deliberately short 128-token setting answered incorrectly and was flagged. This is a deployment check, not a JEE benchmark.**

## Published artifacts

| Artifact | Immutable release | What it contains |
|---|---|---|
| Native MLX adapter | [LlamaJEE-4B-MLX-Step30](https://huggingface.co/OmTheLast/LlamaJEE-4B-MLX-Step30/tree/159ed1ed7238e400bdc59d7720319c6ffd0675f6) | The exact 1.70 MB step-30 adapter, its loader, metadata and checks. Requires the pinned 4B base. |
| Browser package | [LlamaJEE-4B-ONNX-WebGPU](https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU/tree/5871c9b3254effce078432f1ea98c4896c4a22d3) | About 3.08 GB: 32 decoder graphs, 16 output heads, all 31 embedding shards, tokenizer and actual step-30 factors. |

All 183 payload files across the two repositories were downloaded without authentication and matched their recorded hashes. Website-origin access was checked. Artifact availability is verified separately from whether the public browser finishes loading and answering. Download size is not peak memory or evidence of phone support.

The browser runtime can select the unchanged 4B base or the same base with step 30. All 18 browser adapter arrays match the transposed native arrays exactly. This release accepts text only; it does not claim usable 4B question-image support. The existing 9B checkpoints and separate 0.8B option remain selectable.

## Harnesses and measured native results

The [original local lab](../local_lab/README.md), [original browser prompt](../web/harness.js), and [published H0/H1/H2 methods](../harnesses/README.md) remain available. H0 requests a final answer after an output cap. H1 continues the unfinished draft once, then submits. H2 identifies a remaining task and attempts it once, then submits. Each run uses one fixed model and adapter; no separate harness model or new training was introduced.

| Native model, same 24 reused development questions | H0 | H1 | H2 |
|---|---:|---:|---:|
| Base 4B | 15/24 | 17/24 | 16/24 |
| Step 30 | 19/24 | 20/24 | 19/24 |

The extra step-30 answer under H1 had sufficient working. Two base answer gains still had faulty chemistry explanations. These are native development results, not browser scores or independent JEE accuracy. [Full comparison and method history](HARNESS_COMPARISON_2026_11_06.md).

## Actual local browser evidence

Desktop Chrome ran the production UI using a temporary static server and the exact staged model files; no inference API answered the questions. On one elementary constant-acceleration question, both base and step 30 returned 24 m, taking about 64 and 65 seconds respectively. The same loaded graphs served both versions and both recovery policies.

A deliberately short initial output limit exercised the complete H1 and H2 routes. Both reached a final submission, but returned a bare JSON string, `"24"`, instead of the requested answer object. That output was retained. The interface now flags the malformed format for review; it does not silently turn it into a valid answer. Cancellation preserved partial working and kept the model loaded.

The base used 18 zero adapter arrays; step 30 used 18 verified nonzero arrays. A first-token score changed on the same input, demonstrating active adapter use. This is not full native/browser numerical parity or proof that training improved this example. Eleven web tests, fourteen controller tests and four historical normalizer tests passed.

## Public website checks

The actual [ompatnaik.com/llamajee](https://ompatnaik.com/llamajee/) page loaded the pinned files from public Hugging Face URLs and ran the step-30 model. No local model files or inference service replaced the public path.

| Public test on the same elementary question | Observed result |
|---|---|
| H0, artificial 128-token initial cap | Wrong answer: 12 instead of 24 m. The interface retained it and flagged both malformed answer format and disagreement with its narrow constant-acceleration check. |
| H0, normal 768-token setting | Correct answer: 24 m, completed in 359 output tokens and 67.4 seconds. No recovery call was needed. |
| Stop generation | Cancelled while keeping the model loaded and preserving partial working. |

Both public answers used identical step-30 weights. The deliberate output cap changed whether the model could finish its working before the final-submission call. This pair shows that execution settings can change the answer; it is not evidence of a new training collapse or a training repair. One question cannot establish general reliability or settle the wider collapse concern.

The first cold-load attempt exceeded ten minutes. A retry loaded in 297.6 seconds using a partially warm profile with five existing cache entries. The final ordinary-setting test loaded in 2.263 seconds from a warm cache. **These last two numbers are not cold-download performance.** No runtime or model code changed between the first failure and successful retry; the cause of the initial failure remains unresolved.

The public run used all 18 nonzero step-30 factors. A 390-pixel viewport check found no horizontal overflow; that checks desktop browser layout, not inference on a phone.

The ordinary-setting test runner initially labeled its receipt failed because it required a new Hugging Face network request. The already cached model completed generation correctly. A separate cache/evidence check records that distinction; the original failed receipt is preserved and no extra model call was used to change the result.

Phone performance, general browser JEE accuracy and full native/browser numerical parity remain unverified. The browser's 1,536-token input guard and shorter run limits differ from the native comparison; oversized inputs are rejected rather than truncated. No model improvement is claimed from deployment alone.
