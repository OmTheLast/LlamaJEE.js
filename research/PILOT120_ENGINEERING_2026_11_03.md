# One 4B training update survived a restart and ran in Chrome

3 November 2026. A fresh process restored a Qwen3.5-4B training checkpoint exactly. A desktop Chrome test reproduced the effect of its learned update on two synthetic inputs, one text and one image. The 120-family learning pilot has taken zero updates. JEE answer accuracy and reasoning quality remain unmeasured for this adapter.

## What survived the restart

One source-problem family supplied three exercises. Complete solving received 60% of the weight, method planning 20% and step checking 20%. Each exercise contributed its average loss over its answer tokens. The three contributions produced one optimizer update. The base model and vision encoder stayed frozen.

The first process saved the adapter, optimizer, learning-rate schedule, random state and data position. A second process restored step one and reproduced all 248,320 next-token scores on each synthetic input. A third process started from the saved step zero and repeated the same update. All 18 adapter arrays and all 38 optimizer arrays matched exactly, as did the random states and the checkpoint file hashes. These were two executions of one unique update. The highest step reached was one.

## What ran in the browser

The export preserved all 18 adapter arrays. All nine adapted projections changed their probe outputs. Chrome ran the image encoder for the image case, all 32 language layers, and the full output vocabulary. It started from prepared tokens and a fixed 64 × 64 image. The first two decoded tokens agreed with the native model for both inputs, with the adapter on and off.

The winning tokens also stayed the same when the adapter was switched on. To see whether the learned update reached the output, we compared the change in every next-token score with the change measured in native MLX. A value of 1 means the two changes point in the same direction. The minimum was set at 0.90 before inspecting results.

| Test input | CPU ONNX agreement with native MLX | Chrome agreement with native MLX | Relative error in Chrome’s score changes |
|---|---:|---:|---:|
| Text | 0.986376 | 0.998975 | 4.56% |
| Image and text | 0.999460 | 0.999928 | 1.30% |

The reference used 32-bit arithmetic with the original quantized language weights. Changing native arithmetic to its default precision gave the same decoded tokens but direction agreement of only 0.3263 on text and 0.4070 on the image against the 32-bit reference. The evidence supports the export at matched precision on these fixtures. Long sequences, other image sizes, mobile browsers and JEE solutions still need separate tests. Chrome reported a Metal graphics device with WebGPU enabled. Some operations ran elsewhere.

Two failed attempts exposed setup errors. The native image processor initially resized the fixed fixture. The first browser launch lacked a runtime loader file. The team kept both attempts, corrected the settings and file list, and used the original fixtures and thresholds for the successful checks.

## How a weaker checkpoint will be handled

The proposed learning run starts from the unchanged base and a fresh adapter. Its fixed order covers 120 families once, with a review after every 30 updates. Each block contains five families per subject and exam group, with 15 valid and 15 deliberately flawed checking examples across the block. The three exercises per family give 360 exercises for the pass. [Frozen dataset and composition](PILOT120_DATASET_2026_10_30.md).

A drop pauses the next block for a paired review. Compare the same question on the unchanged model, the current checkpoint and the preceding checkpoint. Inspect the input, key, method, answer, parser and finish reason. Save the outputs, settings and scores from both sides.

- An isolated, understood loss can justify one further block of 30 for research. Record the evidence, the reason and what will be checked at the next boundary. A second consecutive warning cannot extend the run again under this exception.
- A key or scoring fault requires a versioned correction and a new comparison of the base and all affected checkpoints. An input or harness fault requires new outputs from both sides. Keep the original evidence.
- A broad collapse reproduced on a fresh paired run closes further updates. Nonfinite values, incorrect identities, data leakage, broken recovery and resource failures require an immediate stop. The 120-update limit applies to every decision.

Twelve tests with invented scores exercised the review rules. The full training worker still needs to enforce the saved decisions.

## What must happen before a learning run

The team still needs a fresh measurement of the unchanged base on the reused 24-question development set and a separate, source-reviewed 120-family confirmation set. Under the planned balance of 20 families in each subject and exam group, at most one of the 60 Advanced places can be filled from the audited 2025 development reservation. That Mathematics family still needs review. The minimum shortfall is **20 Physics, 20 Chemistry and 19 Mathematics Advanced families**, or **at least 59 in total**. The audit admitted zero families. Earlier papers are sourcing leads that still need verified final keys and checks for related or previously used questions.

A separate release must bind the validated training worker, data, schedule, scoring rules, matched control and sealed confirmation allocation before learning begins. The reused development questions will select one checkpoint. Selection requires at least two additional correct answers out of 24, or tied answers plus four more procedure points out of 48 and fewer unresolved verification failures. It also requires all ten preservation answers, 24 usable final-answer formats, and the subject and completion safeguards.

After selection, the independent confirmation set can be opened once. Promotion requires both six net additional correct answers out of 120 and eight additional procedure points out of 240. The original cell, preservation, completion and portability gates also apply. [Training safety gates](TRAINING_SAFETY_GATES_V1.md).
