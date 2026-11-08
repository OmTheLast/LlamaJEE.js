# Did another 30 training problems help Qwen 4B solve JEE questions?

8 November 2026. On the same 24 JEE question images, **the original mixed model went from 19 to 18 correct, and the newer worked-solutions-only model stayed at 17**. The newer model improved the working behind some answers. The original mixed step 30 still led on both correct answers and correct answers backed by sufficient working. The unchanged Qwen base had previously scored 15/24 under the same image and harness conditions.

## Results

| Measure on 24 questions | Mixed 30 | Mixed 60 | Worked solutions 30 | Worked solutions 60 |
| --- | ---: | ---: | ---: | ---: |
| Correct final answers under H0 | 19 | 18 | 17 | 17 |
| Correct on the first attempt | 13 | 13 | 12 | 13 |
| Correct under strict formatting | 13 | 13 | 12 | 13 |
| Correct with sufficient working | 14 | 11 | 10 | 12 |
| Working points (out of 48) | 38 | 35 | 33 | 37 |
| Drafts with unproductive repetition | 12 | 12 | 12 | 13 |
| First attempts hitting the token limit | 11 | 10 | 10 | 10 |
| Usable final answers | 24 | 22 | 23 | 23 |
| Short invalid first attempts | 0 | 0 | 0 | 0 |
| Correct on 10 preservation questions | 10 | 9 | 9 | 9 |

Each question counts once. “First attempt” scores the model's initial response. “Under H0” includes a short final submission when the first response runs out of tokens. All 48 new question runs finished. Ten first attempts per step-60 model reached the token limit, and all 20 short submissions finished within their own limits. No run required a retry. A usable final answer has a readable, allowed format and can still be wrong.

## Which questions made up the 19/24?

The **original mixed step-30 checkpoint** answered **10 of 12 Main** and **9 of 12 Advanced** questions correctly. The **unchanged Qwen3.5-4B base** answered **15 of the same 24** correctly. All questions came from 2025 JEE papers, with four per subject in each exam. The table counts correct final answers under the same H0 submission rule. Subject, exam and answer format are three ways of grouping the same questions.

| Group | Questions | Unchanged 4B | Mixed 30 | Mixed 60 | Worked solutions 30 | Worked solutions 60 |
|---|---:|---:|---:|---:|---:|---:|
| All questions | 24 | 15 | 19 | 18 | 17 | 17 |
| Chemistry | 8 | 4 | 7 | 6 | 7 | 6 |
| Mathematics | 8 | 6 | 6 | 6 | 5 | 6 |
| Physics | 8 | 5 | 6 | 6 | 5 | 5 |
| JEE Main | 12 | 9 | 10 | 11 | 10 | 9 |
| JEE Advanced | 12 | 6 | 9 | 7 | 7 | 8 |
| Select one option | 18 | 11 | 14 | 15 | 14 | 13 |
| Select all correct options | 2 | 0 | 1 | 0 | 0 | 0 |
| Enter a number | 4 | 4 | 4 | 3 | 3 | 4 |

The mixed model gained one Main answer from step 30 to 60 (10 → 11) and lost two Advanced answers (9 → 7). The Advanced losses were an organic reaction sequence and a calculus limit. On the latter, it derived the correct value but repeated its final-answer line. With only two multiple-select questions, the scores give little evidence about that format in general.

### Topics on the 24 questions

| Subject | Main topics (four questions) | Advanced topics (four questions) | Original mixed step 30, Main / Advanced |
|---|---|---|---|
| Chemistry | Aluminium and thallium oxidation states, rate laws, solubility and precipitation, aldol ring closure | Osmotic pressure and molar mass, named organic reactions, a multistep organic synthesis, identifying metal ions with precipitation reagents | 3/4 · 4/4 |
| Mathematics | Area between curves, range of a composite function, a trigonometric functional equation, intervals where a function increases or decreases | Vector cross products and a linear system, a limit at a specified root, complex roots of unity, a limit involving an integral and a trigonometric expansion | 3/4 · 3/4 |
| Physics | Logic gates, dimensions of electric and magnetic flux, force on a charge between plates, wave speed on strings | Reading a Vernier scale, electric flux between coaxial cylinders, fields and potential differences from charged sheets, electron and neutron wavelengths | 4/4 · 2/4 |

The original mixed checkpoint missed five questions covering **aldol ring closure**, **the vector and linear-system problem**, **the trigonometric functional equation**, **flux between coaxial cylinders**, and **fields and potentials from charged sheets**. It submitted the correct answer on the other 19. These are final-answer scores. The separate working review found sufficient justification on 14 of those 19.

## Which answers changed?

* **Original mixed model.** It kept 17 answers correct, gained one and lost two. Both step-60 models newly solved the same functional-equation problem and justified the result. The mixed model lost a chemistry question when it followed an incorrect sequence of reactions. On a series-limit question, it correctly calculated 2.4 but printed its final answer twice, which the submission rule rejected.
* **Worked solutions only.** It kept 15 answers correct, gained two and lost two. It newly solved the series-limit and functional-equation problems. On a third maths question, it calculated 56 and selected the right option twice, costing it the point. It also lost a chemistry ring-closure question. Its earlier submission had picked the right option even though its working had miscounted the ring. Across the ten preservation questions, its total stayed at nine while the identity of the missed question changed.

An offline check deleted an earlier final-answer line only when both lines held the same valid answer. Applied to the saved responses, this recovered one answer for each step-60 model and zero at step 30. The resulting hypothetical scores would be 19 and 19 for mixed, and 17 and 18 for worked solutions. The table gives the measured H0 scores. The duplicate check used saved text and made no new model calls.

## How we compared the checkpoints

Both runs used Qwen3.5-4B with the same 4-bit MLX base and rank-4 LoRA in its last three language layers. Each resumed its own saved step-30 adapter, AdamW state, learning-rate schedule, random state and data cursor. Each completed 30 more updates on exactly the same 30 new JEE problems in the same order. Five problems came from each subject and exam combination. The trainer saved each update and restarted in a second process at step 32. All four checkpoint files passed their identity checks.

The **mixed** recipe gave 60% loss weight to a worked solution, 20% to planning, and 20% to checking a proposed step. The **worked-solutions-only** recipe trained on the identical worked solutions with 100% weight. Across all 60 problems, both saw 20,091 worked-solution target tokens. With its additional exercises, the mixed arm saw 40,725 target tokens in total. This experiment measures the two whole training recipes.

All four checkpoints were evaluated on the same 24 previously used JEE question images using the same deterministic decoding and H0 harness. Each model first got 4,096 tokens to solve a question. If it hit that limit, it received its own draft and 96 further tokens to submit a structured final answer. Final-answer accuracy uses the pre-existing cleanup for these short submissions. The separate strict score shows the count before cleanup. A first response that finishes normally goes directly to the grader. The two step-30 runs are verified saved outputs. Both step-60 runs are new measurements.

Reviewers read the question and the model's first draft with its checkpoint identity masked. Two points mean that the work establishes the answer, one marks useful but incomplete or faulty work, and zero marks an invalid core solution. “Correct with sufficient working” requires both a correct submitted answer and a two-point draft. The four-way comparison assigns one grade to identical drafts on the same question. The private archive retains prior grades and alternative interpretations. The ten preservation questions are a subset of the 24. The independent 120-question and 2026 evaluations remain reserved.

The earlier step-30 report recorded **12** mixed and **11** worked-solutions answers backed by sufficient working. The current masked review of those same drafts yielded **14** and **10**. The fixed answer counts stayed at 19 and 17. Working grades involve judgment. For example, grading an implicit algebra step more strictly reduces the newer model's step-60 supported count from 12 to 11. [Earlier step-30 report](QWEN4B_SOLVE_ONLY_2026_11_08.md).

## Decision

Keep original mixed step 30 as the reference. The additional training produced some genuine new solutions and some regressions. All four checkpoints had zero short invalid first attempts, so this comparison showed no repeat of the short-output failure seen in earlier 9B training. We tested each recipe once on a small, reused development set. These results leave performance on fresh JEE questions open. [Aggregate scores, paired counts and checkpoint hashes](QWEN4B_TWO_RECIPES_STEP60_2026_11_08.json).
