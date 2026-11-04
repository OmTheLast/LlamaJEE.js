# Corrected test instructions and the 4B training comparison

4 November 2026. With corrected question instructions and the same answer-type-specific submission step, the unchanged Qwen3.5-4B answered **15 of 24** development questions correctly. Its step-30 adapter answered **19 of 24**. The trained model gained four answers and lost none in this condition. These questions have been used during development, so this does not establish better accuracy on new JEE questions. No further training ran.

We used an ablation to separate the effects of the test inputs, the final-submission instruction and the trained weights. An ablation changes one component while keeping the others fixed.

Three question contracts needed correction. One choice question allowed one or more options, although its old input told the model to choose one. Two numerical questions allowed up to two decimal places, although their old inputs required integers. The old builder had inferred these restrictions from the answers in the key. The corrected builder derives them from the printed exam instructions without reading the key.

All cells below contain the same 24 questions. “Type-specific” means a short instruction asking for printed option labels on choice questions and a numerical result on numerical questions. This pass runs only when the first response reaches its token limit.

| Question instructions | Base, original submission | Step 30, original submission | Base, type-specific submission | Step 30, type-specific submission |
|---|---:|---:|---:|---:|
| Historical inputs | 15/24 | 19/24 | 15/24 | 20/24 |
| Multiple-select rule corrected | 14/24 | 18/24 | 14/24 | 19/24 |
| Multiple-select and numerical precision corrected | **15/24** | **18/24** | **15/24** | **19/24** |

Removing the single-choice hint cost both models one answer. Correcting numerical precision then helped the base recover one answer. The trained model's final-answer total stayed the same. The type-specific submission instruction recovered one trained answer by returning the required option label instead of the calculated value. It did not repair the multiple-select error.

Numeric grading was aligned with the printed precision rules while preserving the accepted answer values. This grading adjustment alone changed none of the observed final-answer scores. Its purpose was to make the evaluator accept the format permitted by the paper.

The distinction between solving and submitting matters. Under the fully corrected inputs, the base produced **14 correct final answers in its first responses**, while step 30 produced **13**. After the type-specific submission pass, those totals became 15 and 19. First responses reached the token limit on 10 base questions and 11 trained questions. The trained model therefore depended more on the final-submission pass to deliver its answer. The parser could use 23 of 24 base responses and all 24 trained responses under this condition. A usable answer format does not establish valid reasoning.

The review of the written work gives a narrower result.

| Fully corrected inputs | Base | Step 30 |
|---|---:|---:|
| Working-quality points | 35/48 | 36/48 |
| Correct answer with sufficient working, using type-specific submission | 12/24 | 12/24 |
| Responses with unproductive repetition | 8/24 | 11/24 |
| Responses with unresolved checks | 12/24 | 13/24 |

We reviewed the six changed drafts against the saved rubric and retained the existing reviews for identical drafts. One trained response reached the correct core calculation, then introduced a scientific error during extra checking and ran out of tokens. Its final-submission pass recovered the right answer. Awarding full method credit for the core calculation alone would raise the trained working score by one point and the correct-with-sufficient-working count to 13. Under the full-response rubric, the unresolved error remains part of the result. These are automated and coordinator assessments, with the original votes and differences preserved.

The question images, main solving prompt, generation settings and accepted answer values stayed fixed. Both models used the pinned native MLX Qwen3.5-4B snapshot, and the adapter stayed at step 30. Four full responses and four short submissions were generated in this round. Other outputs were reused only after confirming their complete prompt, image and model identities matched the required condition. These are explicitly reconstructed development comparisons, not 24 fresh model runs per cell. Original outputs and scores remain saved.

The evidence supports a development gain in final answers under the corrected harness. It also shows more repetition and no increase in the count of correct answers supported by sufficient working under the full-response rubric. A broad accuracy collapse was not observed on this slice. Model collapse remains a concern to measure through accuracy, working quality and completion separately. The reserved 120-question independent test remains unopened, and no step-31 update or new training authorization was issued in this round.

[First training block](PILOT120_FIRST_BLOCK_2026_11_03.md) · [Earlier looping and submission experiments](PILOT120_DIAGNOSTICS_2026_11_03.md)
