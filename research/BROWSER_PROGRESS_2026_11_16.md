# The browser now lets the 4B model finish active work

16 November 2026. A visitor's geometry question stopped before the browser showed any working. The old timer gave the first response two minutes and the final-answer stage 90 seconds, including time spent reading. A slower device could use that allowance while the model was still making progress.

## What changed

The page shows **Reading the question** with an input count, then **Writing the answer** with an output count. If the model rereads its draft, the page names that step too. Each completed input or output token resets the two-minute timer. A stalled stage still stops, and any text already written stays visible. The response limit, repetition check and Stop generation button still apply.

## What happened in Chrome

We tested the reported question before publishing. Chrome ran the real Qwen3.5-4B step-30 weights on the device, using the public site's final build. Both trials used the same question and the default H0 approach. H0 asks the model for a final answer if its first response uses up its token allowance.

| Response limit | Observed behavior | Maths |
|---|---|---|
| 768 tokens, default | Read 276 input tokens and wrote 768. H0 then read 1,025 input tokens and wrote 13 more. The two stages took 113 and 103 seconds. | Returned an incorrect point. The page also flagged the final-answer format. |
| 1,280 tokens | The first response kept writing for 10 minutes 33 seconds. The final stage needed 1,537 input tokens, one above its 1,536-token limit. The page showed the reason and kept the working visible. | The working derived the correct curve and gave two valid points. It omitted an excluded point and produced no final answer. |

The default final-answer stage exceeded its former 90-second limit and finished. The larger first response exceeded its former two-minute limit and reached its full token allowance. We independently checked the maths for each response. One question gives no estimate of overall accuracy.

Controller tests also covered 35 simulated minutes of advancing counts, a genuine stall, duplicate counts, cancellation and preservation of partial output. The published model files and training checkpoint are the same ones used before this change.

[Open the browser solver](https://ompatnaik.com/llamajee/)
