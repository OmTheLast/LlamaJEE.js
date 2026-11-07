# Qwen 4B step 30 and LFM3 1.7B on identical JEE text inputs

7 November 2026. An earlier comparison gave LFM 18/24 on text and Qwen 19/24 on images. To remove the input difference, we gave Qwen the same 24 question texts, options and instructions used in the saved LFM run. The head-to-head result was **21/24 for Qwen and 18/24 for LFM**. We also tested both on a separate set of 12 original problems. Keep Qwen step 30 as the main solver for now. LFM is a smaller candidate for devices that struggle with Qwen, but it returned fewer correct answers and fewer supported solutions on both sets. These results do not establish that step-30 training caused the advantage.

The models are Qwen3.5-4B with the released step-30 adapter and unchanged LFM3-1.7B text, both using local 4-bit MLX weights. **H0** is a small piece of code: the model first tries to solve the problem, with up to 4,096 output tokens. If it reaches that limit, the same model gets the question and its own draft and has 96 tokens to submit a structured answer. Each question starts a new context. This evaluation made zero training updates.

### Reused JEE development questions

| Measure (24 questions) | Qwen3.5-4B step 30 | LFM3-1.7B text |
|---|---:|---:|
| Correct on the first solve (Direct) | 13 | 5 |
| Correct after H0 | 21 | 18 |
| H0 correct under strict formatting | 13 | 11 |
| H0 outputs in usable format | 24 | 22 |
| First solves reaching the token cap | 11 | 19 |
| H0 terminal calls reaching their cap | 0 | 3 |
| Correct with sufficient working in the full draft | 19 | 11 |
| Sufficient working outside private thinking, in the direct answer channel | 19 | 5 |
| Questions with at least three unproductive cycles | 8 | 20 |
| Generation calls | 35 | 43 |
| Generated tokens | 64,672 | 92,981 |
| Peak MLX allocation, decimal GB | 4.30 | 1.59 |
| Median native stage time per problem, seconds | 38.0 | 19.8 |

Both correct: 17; Qwen alone: 4; LFM alone: 1; neither: 2.


The models tied at 9/12 on Advanced. Qwen got 12/12 on Main; LFM got 9/12. These groups are too small for general exam-level conclusions.

### New project-authored transfer questions

| Measure (12 questions) | Qwen3.5-4B step 30 | LFM3-1.7B text |
|---|---:|---:|
| Correct on the first solve (Direct) | 8 | 2 |
| Correct after H0 | 9 | 7 |
| H0 correct under strict formatting | 9 | 4 |
| H0 outputs in usable format | 12 | 10 |
| First solves reaching the token cap | 3 | 10 |
| H0 terminal calls reaching their cap | 0 | 3 |
| Correct with sufficient working in the full draft | 8 | 6 |
| Sufficient working outside private thinking, in the direct answer channel | 8 | 0 |
| Questions with at least three unproductive cycles | 3 | 11 |
| Generation calls | 15 | 22 |
| Generated tokens | 33,530 | 48,381 |
| Peak MLX allocation, decimal GB | 4.30 | 1.58 |
| Median native stage time per problem, seconds | 33.3 | 31.1 |

Both correct: 6; Qwen alone: 3; LFM alone: 1; neither: 2.


A correct label can hide a bad explanation. In the 24-question set, both answered 36 on a monotonicity problem. Qwen found all five endpoints and summed their squares; LFM failed to account for the break at zero and never established the sum. On the new set, the smaller model had a useful win: both found the free silver concentration, but only LFM converted to millimoles correctly. Also, one of Qwen's nine correct fresh labels hid a wrong rate ratio. Counting final answers alone would miss all three differences.

The 24-question native first attempts often reached 4,096 tokens: 11 for Qwen and 19 for LFM. Repetition was common even when H0 recovered a correct label. Seven of LFM's 20 repetition findings were mainly formatting rehearsal. Removing those leaves 13 LFM drafts and eight Qwen drafts with non-format repetition on this set. Neither a token cap nor a repeated passage alone means a science answer is wrong.

On the 12 new problems, Qwen was correct on 2/4 physics, 3/4 chemistry and 4/4 maths questions. LFM was correct on 0/4, 4/4 and 3/4, respectively. These are counts for four specific problems per subject, not estimates of either model's subject-wide accuracy.

### Actual browser check

Both models loaded and generated locally in desktop Chrome 157 on the same Mac, with weights staged on disk. Both used the deployed H0 code and the same elementary physics question, greedy decoding, thinking disabled, 128 solve tokens and up to 96 submission tokens. Each answered twice: once immediately after loading and once with the model already in memory.

| Measurement | Qwen step 30 | LFM text |
|---|---:|---:|
| Initialization from staged files | 5.26 s | 1.48 s |
| First / second solve | 66.30 / 64.73 s | 1.94 / 2.87 s |
| First visible output, first / second solve | 21.57 / 20.33 s | 0.63 / 0.49 s |
| Model bytes served during this test | 2.85 GB | 1.11 GB |
| Sampled peak Chrome process-tree RSS | 6.65 GiB | 5.20 GiB |
| Numerical result in both replies (expected 24 m) | 12 | 24 |
| Submissions in the required format | 0/2 | 0/2 |

LFM was substantially faster on this one browser fixture. Its reply contained the correct value in malformed output. The harness flagged the formatting; its narrow physics check recognized 24. Qwen returned 12 and triggered both a format warning and the numeric disagreement check. In a [previous browser test](STEP30_BROWSER_RELEASE_2026_11_06.md), Qwen returned 24 at its normal 768-token budget. This comparison used a deliberately short budget, two different ONNX implementations, no internet download timing and no phone. It does not measure general browser JEE accuracy. Process RSS can count shared memory twice and is not GPU memory or a minimum RAM requirement.

One pre-inference path issue on each browser configuration was fixed in the isolated test setup and retained in its record. Neither change altered the model or its settings. No public solver code was changed and LFM was not deployed.

### How to interpret these measurements

- For the 24 official questions we reused hash-verified LFM outputs and reran only Qwen. For the 12 new questions we ran both models. The new set includes two questions per subject in each of two intended styles (Main and Advanced); these are original exercises, not official exam papers. Two independent project solutions agreed on every key before inference. The independent 120-question and 2026 final pools were untouched.
- Input text, H0 instructions, token ceilings, deadlines and scoring rules matched. Chat templates, tokenizers and native generation settings differed: Qwen was greedy with thinking off; LFM used thinking on for its solve and its native sampling preset. The primary score uses the native answer channel and pre-existing format cleanup on the short submission; strict formatting is shown separately. Token counts are not interchangeable between tokenizers.
- A source-based review scored the entire initial draft, including private reasoning where present: 0 for no useful route, 1 for useful but flawed or unfinished work, 2 for a derivation that establishes the answer. The answer-only submission earns no extra procedure credit. We distinguish full working from the ordinary answer channel. These judgments were made by automated reviewers who knew model identity, without teacher adjudication. See the [scalar data file](MATCHED_TEXT_2026_11_07.json).
- Native timing covers successful generation stages only and excludes loading. The historical LFM run and the new Qwen run had different desktop loads. One extra development-stage timeout for each model is recorded separately from completed cost: Qwen 300.13 s / 2,597 output tokens and historical LFM 300.08 s / 3,152. In both cases, the unchanged retry reproduced the entire interrupted text prefix. A separate launcher import failure on fresh Qwen produced no model output. These were technical interruptions, not graded wrong answers.
- No unchanged Qwen base was included in this matched text run, so the result does not isolate the effect of fine-tuning. The samples are small and text-only. Earlier Qwen image scores, native performance, browser smoke results and phone performance are different measurements.
