# Making room for the browser's final answer

18 November 2026. The previous 4B browser test wrote a long solution but could not submit its final answer. Rereading the question and draft needed 1,537 input tokens, one above the browser's 1,536-token limit.

The final-answer step now counts its complete input with the model's tokenizer and chat template. Shorter instructions fit that saved question and draft in 1,515 tokens, preserving every word. If a longer draft still exceeds the limit, the browser keeps its opening and latest work, marks the omitted middle, and shows a notice. The full working stays visible.

We also found that an inferred answer could require an equation or coordinates. The browser's final-answer format now supports a written answer for those questions. Explicit option and numeric formats keep their requirements.

The change passed 20 controller tests, 16 web tests and four checks of historical answer parsing. The Chrome interface test covered reading and writing progress, interruption, cancellation and preserving partial output.

We reran the same user-supplied geometry question before publishing, using the real Qwen3.5-4B step-30 model in Chrome with H0 and a 1,280-token response limit.

| Measurement | Observed |
|---|---|
| First response | 276 input tokens, 1,280 output tokens, 200.78 seconds |
| Final-answer step | 1,515 input tokens, 15 output tokens, 180.95 seconds |
| Total solve time | 6 minutes 22 seconds |
| Draft removed | None |
| Final answer | A valid point on the required curve, displayed in the answer box |

An independent geometry check confirmed the returned point. The supplied question had no answer choices, so we could not score completeness against an intended option list. The UI still showed its existing review notice because the draft did not produce a separate CHECK section. The model included a point check in its working.

The first draft's prompt, generated token IDs and text matched the earlier 1,280-token attempt exactly. The revised final-answer step could read that complete draft and submit the supported point.

This is one repeated browser diagnostic. The correction resolved the final-submission failure on this case. Device load affects time, and these timings do not establish a speed improvement.

[Use the browser solver](https://ompatnaik.com/llamajee/) · [Earlier timeout test](BROWSER_PROGRESS_2026_11_16.md)
