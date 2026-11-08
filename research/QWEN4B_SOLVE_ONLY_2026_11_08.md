# Training Qwen 4B on worked solutions alone

8 November 2026. We tested whether Qwen3.5-4B solved JEE problems better when trained only on worked solutions. On 24 previously used question images, the solve-only adapter answered **17/24** correctly, the mixed adapter answered **19/24**, and the unchanged base answered **15/24**. Correct answers backed by sufficient working numbered **11, 12 and 12**, respectively. Keep mixed step 30 as the current checkpoint. In the primary review solve-only had 1 fewer looping draft, 2 fewer correct answers and 1 fewer supported answer.

## What changed during training

Both adapters started from the same saved model weights, optimizer and random state. Each trained for 30 updates on the same 30 source problems in the same order, with five problems per combination of subject and exam. The mixed objective gave 60% weight to a worked solution, 20% to planning and 20% to checking a proposed step. The solve-only adapter gave 100% weight to the same worked solution. Only 423,936 LoRA parameters in the final three language layers received updates.

The full solutions contained **9,994** supervised tokens. The mixed recipe used **20,194** including planning and checking. Removing those two exercises changes both task mix and total supervision. This comparison cannot assign a difference to planning or checking separately.

## How the three configurations performed

All three configurations received the same images, printed answer rules, prompts and deterministic decoding. H0 gives the model up to 4,096 tokens for the first solve. If it reaches that limit, H0 gives the same model its own draft and up to 96 tokens to submit the final answer. The main score uses the project's existing cleanup of those short submissions. The strict score requires the original output format. The two earlier configurations use their saved prediction records.

| Measure | Unchanged base | Mixed step 30 | Solve-only step 30 |
| --- | ---: | ---: | ---: |
| Correct on the first solve | 14 | 13 | 12 |
| Correct under H0 | 15 | 19 | 17 |
| Correct under H0 with strict final formatting | 15 | 13 | 12 |
| Correct with sufficient working | 12 | 12 | 11 |
| Working points, out of 48 | 35 | 36 | 34 |
| Questions with an unproductive loop | 8 | 11 | 10 |
| First responses reaching their token limit | 10 | 11 | 10 |
| Usable final-answer formats | 23 | 24 | 23 |
| Usable final answers ending normally | 23 | 24 | 23 |
| Calls, including short submissions | 34 | 35 | 34 |
| Correct on the 10 preservation questions | 10 | 10 | 9 |

A full working grade requires the decisive steps that establish the result. A useful but incomplete solution earns one point. An invalid route or absence of useful working earns zero. A loop requires at least three unproductive repetitions. Model identifiers were hidden during the new draft review, with historical control drafts mixed in for calibration. Each new draft received one project review. Reviewers flagged 1 new draft as uncertain and recorded 3 differences in the calibration comparison. The primary table retains its recorded grades.

When the newly masked ratings are applied consistently to all arms with identical draft text, the supported-answer and loop counts are as follows. Final-answer counts come from the same fixed answer key in both readings.

| Configuration | Supported, primary | Supported, masked reread | Loops, primary | Loops, masked reread |
| --- | ---: | ---: | ---: | ---: |
| Unchanged base | 12 | 11 | 8 | 8 |
| Mixed step 30 | 12 | 14 | 11 | 11 |
| Solve-only step 30 | 11 | 11 | 10 | 10 |

Separate plausible readings of individual drafts put solve-only at 10–12 supported correct answers. Each reading changes one grading convention. The exact-answer scores stay fixed.

| Compared with | Measure | Both | Solve-only alone | Comparison alone | Neither |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mixed step 30 | Correct answer | 16 | 1 | 3 | 4 |
| Mixed step 30 | Correct with sufficient working | 9 | 2 | 3 | 10 |
| Mixed step 30 | Loop detected | 9 | 1 | 2 | 12 |
| Unchanged base | Correct answer | 14 | 3 | 1 | 6 |
| Unchanged base | Correct with sufficient working | 10 | 1 | 2 | 11 |
| Unchanged base | Loop detected | 7 | 3 | 1 | 13 |

The unchanged base and mixed step 30 retained all ten preservation answers under H0. Solve-only retained 9 of ten. The pilot requires all ten for checkpoint selection. Solve-only also returned a usable final format on 23/24 questions, against a requirement of 24/24. The project retained the new adapter for research. Independent confirmation and browser performance were outside this experiment.

## Where the answers changed

| Group | Questions | Unchanged base correct | Mixed correct | Solve-only correct |
| --- | ---: | ---: | ---: | ---: |
| Advanced | 12 | 6 | 9 | 7 |
| Main | 12 | 9 | 10 | 10 |
| Chemistry | 8 | 4 | 7 | 7 |
| Mathematics | 8 | 6 | 6 | 5 |
| Physics | 8 | 5 | 6 | 5 |

These 24 images have been used to design the training and answering procedure. The counts estimate performance on this development set. The 30 training families and 24 development questions had zero shared family IDs, source IDs or exact image hashes. This experiment used the question images. The earlier Qwen–LFM comparison used a common text rendition of the questions.

## Training and recovery measurements

The 30 forward, backward and optimizer updates took 26.08 seconds in their measured intervals, including a resource check before each parameter update. The two worker processes took 40.10 seconds combined, including model loading, verification and checkpoint writes. Peak MLX allocation was 10.04 GB during training. Inference token counts and elapsed times for each arm are in the aggregate file. The archived controls ran in earlier sessions with different desktop loads. The first worker stopped after update 2. A new process restored the optimizer, adapter, random state and data cursor, then completed update 30. A CPU check verified all 31 committed checkpoints, including initialization. The original mixed step-30 weight file retained its published hash.

[Aggregate measurements and checkpoint identifiers](QWEN4B_SOLVE_ONLY_2026_11_08.json) · [Earlier corrected H0 comparison](PILOT120_ABLATION_2026_11_04.md) · [Earlier common-text comparison](MATCHED_TEXT_2026_11_07.md)
