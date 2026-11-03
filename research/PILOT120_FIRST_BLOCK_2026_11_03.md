# First 30 training updates on Qwen3.5-4B

3 November 2026. On the same 24 JEE development problems, the unchanged model answered 15 correctly and the trained model answered 19 correctly. Five answers improved and one regressed. More replies also got stuck repeating a line of reasoning, and one reply lost the required answer format. **We saved the step-30 checkpoint and paused training. It did not qualify for the independent test.**

| On the same 24 problems | Unchanged 4B | After 30 updates |
|---|---:|---:|
| Correct final answers, including a short answer pass when needed | 15 | 19 |
| Correct answers returned directly by the first response | 13 | 14 |
| Correct answers on the 10 problems marked for preservation | 10/10 | 10/10 |
| Points for the method, with two points available per answer | 34/48 | 37/48 |
| Solutions with sufficient, scientifically correct working | 11 | 13 |
| Answers that were both correct and sufficiently justified | 11 | 12 |
| First responses that reached the token limit | 11 | 10 |
| Final responses in a usable answer format | 24 | 23 |
| Responses that repeated a reasoning cycle without progress | 7 | 10 |

## What changed

The first response alone produced one net additional correct answer. The short answer pass recovered five correct answers for the checkpoint and two for the unchanged model. On the one question the checkpoint lost, it found the right numerical value before its first response reached the token limit. Its short answer pass returned that value where the question required an option number.

Four responses started looping and one previously looping response stopped. The original baseline review had counted eight loops. A second review of the same saved work, with the model labels hidden, revised that count to seven. The table uses this common scoring rule. We counted a loop when the same passage or reasoning cycle repeated at least three times without adding mathematical content. A long calculation that works through different cases can still make progress.

The answer count rose by four. The count of correct answers supported by sufficient working rose by one. These 24 development questions have been used before. The small, reused sample leaves open how well the result will carry over to unfamiliar problems.

## How we trained and compared the models

The first block used 30 distinct problem families, five from each combination of subject and exam. Each family supplied three exercises for a single training update. Solving the whole problem contributed 60% of the update, planning a method 20%, and checking a proposed step 20%. We trained 423,936 adapter parameters in the last three language layers. The original weights and vision encoder stayed frozen. The earlier one-update engineering test used a separate run. [Pilot data and composition](PILOT120_DATASET_2026_10_30.md) · [Engineering test](PILOT120_ENGINEERING_2026_11_03.md)

Both models received the same question images, instructions and generation settings. Each first response could use 4,096 tokens. Only a reply that reached this limit received a second pass, with up to 96 tokens to return a final answer from its own draft. We scored answers against the official keys. A separate project-assisted review graded the decisive working on a 0–2 scale. Reviewers saw the original questions and kept the model labels hidden when comparing changed responses. These grades have no external human certification.

## Independent test reserved

The separate confirmation set contains 120 source problems, with 20 in each combination of Physics, Chemistry or Mathematics and Main or Advanced. The 60 Main problems come from two 2025 shifts. The 60 Advanced problems come from four official papers from 2015–16. We checked source images and final keys, separated the keys from solver inputs and screened all 3,600 Main–Advanced pairs for overlap. Review removed close variants across years and a question for which all candidates received credit. Public historical papers may have appeared in model pretraining. Neither model has run on this confirmation set. [Official JEE Advanced paper archive](https://jeeadv.ac.in/archive.html)

Two corrections are part of this record. First, a reference explanation misread a caliper diagram. The printed answer was correct. We checked the original markings and applied the corrected explanation to both models. Second, an early screening script decoded one 2026 question assigned to an extraction-only pilot before its year check stopped it. Its text was never printed, compared, saved in the new review or sent to a model. The reserved 2026 final-test split was excluded throughout. The repaired reader checks the source year and role before decoding a question.

## What happens next

Step 31 has not run. We will inspect the newly looping replies and the option-format failure against the unchanged model under the same settings. That comparison will help separate errors in the model's first response from errors in the short answer pass, and inform the decision on further training. The independent test stays reserved for an eligible checkpoint.
