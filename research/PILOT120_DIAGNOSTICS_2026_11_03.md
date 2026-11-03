# What made the 4B solver repeat itself or submit the wrong option?

3 November 2026. On 24 previously used JEE development questions, the unchanged Qwen3.5-4B answered 15 correctly. After 30 training updates it answered 19 correctly. This establishes a gain on those 24 problems. Accuracy on fresh problems remains unmeasured. The project paused training to investigate repeated working and answer submission in separate tests. [First training block](PILOT120_FIRST_BLOCK_2026_11_03.md)

## Can we safely stop a repeating answer?

We replayed the first response from both models on all 24 questions. A fixed rule looked only at text already written. It issued a warning when three separate passages shared at least 70% of their short, ordered phrases. We compared its warnings with the existing source-based review, then inspected what the solver had actually established at the moment of each warning.

| Repetition check on the same questions | Unchanged 4B | Step 30 |
|---|---:|---:|
| Reviewed loops that the rule detected | 3 of 7 | 6 of 10 |
| Warnings on responses judged to make progress | 4 | 3 |
| Reviewed loops the rule missed | 4 | 4 |
| Warnings where the solver already had enough correct working | 2 of 7 | 4 of 9 |
| Warnings where the required final-answer submission was already present | 0 of 7 | 0 of 9 |

The arithmetic and phrasing can repeat for different reasons. On a calculus question, the rule interrupted both saved responses during a correction to their algebra. Both later reached the correct option. On another problem, the trained model derived a correct value before the warning and identified its option number later. Across both models, five warnings came before sufficient working on questions that eventually received correct final answers.

**Decision.** This text-matching rule misses real loops and can interrupt solutions that are making progress. It is unsuitable as an automatic stop. Replaying the saved text measures what a rule could have seen at each point. Answer quality after interrupting a live model was outside this measurement.

## Does the short answer pass submit the right kind of answer?

We kept each original draft fixed and reran only the short answer pass, using both the unchanged model and step 30. We tested the existing instructions and a new instruction tailored to the visible answer type. For a choice question, it asks for the option label even when the calculation produces a different number. Across the 24 questions in both conditions and four cross-checks on the troublesome draft, we made 100 fresh short submissions. With the original instructions, all 21 submissions that had actually been needed in the first experiment reproduced the original output exactly.

| Final result when the short pass is used only after a draft reaches its length limit | Original instructions | Instructions specific to the answer type |
|---|---:|---:|
| Unchanged 4B, correct answers | 15/24 | 15/24 |
| Step 30, correct answers | 19/24 | 20/24 |
| Step 30, responses usable by the original answer parser | 23/24 | 24/24 |

One question accounts for the gain. Given the trained model's saved draft, **both** models submitted the calculated value under the original instructions and the correct option label under the new ones. Given the unchanged model's draft, both supplied the correct label under either instruction. The evidence points to an interaction between what the draft said and how the short pass was asked to finish it.

No previously correct submission became wrong on these questions. Three already-wrong submissions changed to a different wrong choice. When we tested each short pass on all 24 drafts per model, exactly 14 of 24 replies per model and instruction used the requested JSON format as written. The existing parser could still recover usable answers from other replies.

The original training comparison remains 15 versus 19. The separate result of 20 uses a different submission instruction on the same development set.

**A source check limits the interpretation of both scores.** We compared all 24 recorded answer types with the instructions in their six original exam papers. The papers had 18 single-choice, two multiple-select and four numerical questions. The experimental input labeled one of those multiple-select questions as single-choice. The dataset builder had inferred its answer type from the number of correct choices in the key. That disclosed to both models that exactly one choice was correct on this question. It was a different question from the option-submission failure. We retained the original scores as historical results. Any comparison on repaired inputs must take answer types from the printed instructions and retest both models. [Printed exam section](https://jeeadv.ac.in/past_qps/2025_2_English.pdf#page=10)

## Does asking the solver to stop after the decisive work help?

We generated fresh responses with the same two frozen models. We tested an instruction to finish as soon as the required work was complete and to move past checks it had already performed. Four questions were chosen because step 30 had begun looping on them after training. Two additional questions, one numerical and one single-choice, served as controls. We evaluated the first responses on their own. Reviewers graded the new working with the model labels hidden.

| Four questions selected for earlier looping | Unchanged model, original → revised instruction | Step 30, original → revised instruction |
|---|---:|---:|
| Responses with a reasoning loop | 0/4 → 3/4 | 4/4 → 4/4 |
| First responses with the correct final answer | 2/4 → 1/4 | 1/4 → 1/4 |
| Points for the written method | 6/8 → 5/8 | 6/8 → 5/8 |

Both models still solved both control questions with sufficient working and without looping. We rejected this instruction. It failed to remove any of the four targeted loops and introduced loops on the unchanged model. The six deliberately selected questions do not estimate the rate of looping across JEE.

## What happened when we removed the answer-count hint?

We reran the affected physics question on both frozen models using the printed multiple-select instructions. With the original single-choice hint, both models submitted the correct option after their first responses reached the length limit. When told that one or more options could be correct, both first responses again reached the limit. The unchanged model's short answer pass selected all four options in a format the parser rejected. Step 30 used a valid format but selected the correct option plus an incorrect one. Both lost the point.

Changing the question's instructions affected the model's answer independently of the other question's option-submission error. The original 15/24 and 19/24 include the answer-count hint. The separate 20/24 submission experiment also used that original input. This single-question rerun shows why the hint matters. It does not give a new 24-question benchmark.

**Training remains paused at step 30.** Next, build the answer-type field from the printed exam section and check that question inputs never derive it from a private answer key. Test the option-submission instruction on additional development questions before deciding whether to train another block. The independent set of 120 remains reserved.
