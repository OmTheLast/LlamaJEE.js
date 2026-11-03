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
