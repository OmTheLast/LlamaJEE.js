# Fixed-model harness comparison

6 November 2026. With the existing 4B step-30 weights unchanged, one plain continuation increased correct final answers from **19/24 to 20/24** on reused development questions. A more structured recovery stayed at **19/24**. The extra correct answer from plain continuation had sufficient supporting working. This is a small measured result, not independent JEE accuracy.

The implemented methods and prompts are published in [harnesses/](../harnesses/README.md). The [original local 9B harness](../local_lab/README.md) remains available. No additional model was trained for this comparison.

## How the methods changed

These are separate experiments with their own conditions. The entries below are not one cumulative accuracy curve.

| Stage | What was introduced | Recorded outcome and source |
|---|---|---|
| Original interactive lab and browser interface | One bounded answer, streamed output and final-format checks. The interface itself did not certify correctness. | [Original Mac entry point](../local_lab/start.py), [native prompt and parser](../local_lab/worker.py), [browser prompt and checks](../web/harness.js). No benchmark score is assigned to user interaction history. |
| 23 September: completion control | A 512-token instruction to check and finish; separately, a 96-token final-answer prefix and deterministic normalization. | The long controller gained no correct answers. The forced serializer changed unchanged 4B from 13/24 to 15/24 and unchanged 9B from 15/24 to 19/24 on that historical reused slice. [Report](COMPLETION_CONTROL_RESULT.md). These are not today's corrected input condition. |
| 3 November: loop and option diagnostics | Tested a repetition stop rule, a direct completion instruction and answer-type-specific submission. | The repetition stop and completion instruction were rejected. Typed submission changed step 30 from 19/24 to 20/24 on the old inputs; a source audit then found an answer-count hint. [Report](PILOT120_DIAGNOSTICS_2026_11_03.md). |
| 4 November: corrected reference | Removed key-derived type/precision hints and compared original versus typed submission on fixed models. | Corrected typed H0 was 15/24 base and 19/24 step 30. Original submission on those corrected inputs was 15/24 and 18/24. [Report](PILOT120_ABLATION_2026_11_04.md). |
| 6 November: bounded recovery | Compared H0 with one plain continuation and one targeted recovery, keeping weights fixed. | Latest paired totals are 15/17/16 for the base and 19/20/19 for step 30, as detailed below. [Implemented controller](../harnesses/controller.js). |

## Results

| Fixed model | Direct first response | H0: typed submission | H1: plain continuation | H2: targeted recovery |
|---|---:|---:|---:|---:|
| Original Qwen3.5-4B | 14/24 | 15/24 | 17/24 | 16/24 |
| Same base with step-30 adapter | 13/24 | 19/24 | 20/24 | 19/24 |

The direct and H0 results are the saved source-corrected condition from the [previous comparison](PILOT120_ABLATION_2026_11_04.md). The new recovery calls used those same drafts. All 24 questions are included in each total; this is not a table of only the failures selected for recovery.

H1 gained two base answers and one step-30 answer relative to H0. H2 gained one base answer and no step-30 answer. Neither policy lost an H0-correct answer. However, correct final choices did not always mean correct working: two base gains still had contradictory chemistry explanations. The plain-continuation maths gain had sufficient working for both models.

Usable final formats were 23, 24 and 23 for the base across H0/H1/H2, and 24, 23 and 22 for step 30. These format failures were retained. A parser change was not used to improve the reported scores.

Seven selected combined traces received project-level, source-based scientific review. It was not external expert certification or fully blinded review. All 144 final outcomes were independently checked against the frozen scoring rules. No new aggregate procedure score or loop rate was assigned to all recovery traces.

## What was tested

H0 asks for a type-specific final answer after a draft reaches its output limit. H1 continues that draft once, then asks for the final answer. H2 asks for a short record of the unfinished task, attempts it once, then asks for the final answer. No answer keys entered generation or selected between competing outputs.

Every capped draft was included: ten base drafts and eleven step-30 drafts, including already-correct controls. The remaining 27 model/question pairs were unchanged. Both policies allowed at most 608 additional output tokens: 512+96 for H1 and 96+416+96 for H2. This compares two complete policies; it does not isolate decomposition from prompt structure, call count and working-token allocation.

Three of 21 task-state records failed to complete valid JSON. The frozen policy retained their H0 result. Those are failed state proposals, not successful recoveries. Twenty of 21 plain work continuations and 17 of 18 executed targeted work passes also reached their new output caps. Submission calls completed. This does not establish that earlier loops were prevented, and a length cap alone does not prove repetition.

## Measured extra cost

| Model / policy | Calls | Input tokens | Output tokens | Observed stage time |
|---|---:|---:|---:|---:|
| Base / H1 | 20 | 106,933 | 5,214 | 117.8 s |
| Base / H2 | 26 | 134,883 | 4,079 | 127.6 s |
| Step 30 / H1 | 22 | 118,184 | 5,644 | 470.7 s |
| Step 30 / H2 | 31 | 164,460 | 5,000 | 722.6 s |

These are the newly executed recovery calls, including their replacement final submissions. They are not full-solver timings or net costs after subtracting the old H0 submission. Concurrent desktop activity affected the second arm, so time differences are not a controlled model-speed comparison. Peak native allocation was 5.38 GB; no memory or deadline guard tripped.

Both policies reprocess the saved draft. Native stage inputs ranged from 4,469 to 6,075 tokens, despite the small task-state record. The targeted policy used more calls and input processing without improving the trained model's answer count.

## What the public code establishes

The public controller implements the tested routing, instruction text, budgets and state fallback with an injected runtime. Its tests cover normal routing, malformed and duplicate state fields, exact assistant continuation, cancellation, deadlines, context rejection and output limits. These are code checks with synthetic adapters, not another model evaluation.

The native experiment reused historical H0 outputs. A live browser invocation can instead compute that fallback on demand; the new call is recorded. Browser input limits, chat templates, images and precision can differ. The live interface must display its actual outcome; the native 20/24 figure is not a measured browser score.

Plain continuation was the stronger of these two tested recovery policies. The targeted version remains available as an experimental comparison, not as a selected improvement. The independent confirmation questions and protected 2026 questions were not used. The question bank, answer keys and raw private outputs are not part of this public release, so this is an inspectable methods/results release rather than a complete public reproduction dataset.

The [step-30 MLX adapter](../adapters/qwen35-4b-pilot120-step030/README.md) contains the same saved weights used here. Model training and harness changes remain separate measurements. Machine-readable aggregate results and code correspondence are in [native-results.json](../harnesses/native-results.json) and [correspondence.json](../harnesses/correspondence.json).
