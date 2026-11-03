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
