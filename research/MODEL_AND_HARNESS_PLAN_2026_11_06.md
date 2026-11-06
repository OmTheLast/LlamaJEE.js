# Two workstreams for LlamaJEE.js

6 November 2026. This is a development plan. No new training, inference or website deployment occurred while preparing it.

The project will develop the small JEE model and the software that runs it as two separate workstreams. Each needs a measurable contribution. The end goal remains a useful solver that can run on a phone or in a browser within practical download, memory and response-time limits.

The latest corrected development comparison gives 15/24 correct answers for the unchanged 4B and 19/24 for step 30 with the same type-specific submission pass. Both have 12 correct answers supported by sufficient working. Repetition appears in eight base responses and eleven trained responses. These previously used questions guide development. A target of 22–24 correct is an ambition to test, not an established capability. [Completed comparison](PILOT120_ABLATION_2026_11_04.md)

## Workstream 1 — Model training

Improve what the model learns while keeping the answering harness fixed.

The first proposed experiment is a separate solve-only adapter trained from the same preserved initialization for 30 updates. Use the same first 30 training families, order, existing full-solution targets, base revision, final-three-layer LoRA and optimizer settings. Compare it with the saved mixed-task step-30 adapter and unchanged base under the corrected harness.

The existing recipe uses 60% solving, 20% planning and 20% step checking. Removing the two auxiliary losses tests whether that combined task mixture helps or hurts the observed result. It does not isolate planning from checking or test whether shorter rewritten solutions would help.

The comparison matches families, updates and full-solution examples. It does not match total supervised tokens or compute. The existing block exposes 20,194 assistant target tokens across the three views, while the solve-only arm uses the same 9,994 full-solution target tokens. Record this difference rather than attributing any change solely to a particular teaching skill.

Judge the endpoint using answers, sufficient working, repetition, completion and cost. Preserve every completed training state and failed result. Evaluation questions remain outside training. A lower training loss does not establish better JEE solving.

## Workstream 2 — Harness development

Improve how the application uses fixed model weights. The harness controls the question input, subproblem state, model calls, checks and final submission.

All five remaining wrong step-30 answers followed drafts that reached the output cap. Saved reviews show unfinished calculations and option checks, plus a visual-reading and chemistry failure. Formatting alone cannot repair all of these.

The first proposed comparison uses the same frozen base and step-30 models.

| Controller | Action after a capped first response |
|---|---|
| Reference | Current type-specific submission, up to 96 output tokens |
| Plain continuation | Up to 512 additional output tokens, followed by the same submission pass |
| Targeted recovery | Up to 96 tokens to identify unresolved work and 416 to address it, followed by the same submission pass |

These budgets remain proposals until implementation freezes the experiment. Both recovery paths have the same maximum extra output allowance. Targeted recovery has an extra prompt-processing pass, so total compute is not equal. Measure input tokens, output tokens, time and memory.

Route every capped draft through the tested rule, including those that already led to correct answers. Do not use answer keys or question identifiers to select a repair. Permit one recovery attempt. Preserve useful work and uncertainty, and keep final submission separate from verification. A valid answer format or a model's own confidence does not make a solution correct.

The primary contrast is targeted recovery against plain continuation. It asks whether the structure adds value beyond extra generation. The old reference remains a third comparison. Use the existing 24 development questions for this bounded experiment, then test the eventual selected system on the reserved independent set.

## Intended architecture

The proposed controller follows reading, task planning, solving, targeted checking or recovery, and final submission. Its compact state records givens, applicable conventions, completed subresults, unresolved tasks, candidate answers and check status. It can later use a small concept/method registry and a dependency graph where they have measured value. Separate controller stages do not require separate model downloads.

Arithmetic or symbolic tools are later candidates for supported calculations. Program-aided language-model research provides evidence that external computation can help on some reasoning tasks, but it does not establish a gain for this JEE model or browser runtime. [PAL](https://arxiv.org/abs/2211.10435) Likewise, research on trained process supervision is distinct from asking our current solver to verify itself. The existing project diagnostics found that self-verification can remain wrong. [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050)

Browser feasibility is an early harness deliverable. The current public 9B browser adapter has a 1,536-token input limit and different prompts from the measured native 4B controller. A full 4,096-token native draft cannot simply be replayed there. Check the intended 4B artifact, compact state, staged calls, cancellation and memory in a real browser before expanding the design. Native accuracy alone will not be called browser readiness. A separate visual model remains a later experiment if it earns its resource cost.

## Keep the contributions separate

Model experiments use the corrected reference harness unchanged. Harness experiments use the existing base and step-30 weights unchanged. Once candidates are selected, compare old and new model weights crossed with old and new harnesses to measure their combined effect.

Report final answers, sufficient correct working, repetition, completion, format validity and resource cost separately. Keep the independent 120-question confirmation reserved until model and harness choices are frozen. Run heavy jobs sequentially on the shared Mac GPU while preparing both workstreams in parallel. Review each bounded experiment at its endpoint rather than repeatedly reopening every earlier step.

The current result is a working reference and a concrete plan for two experiments. No new adapter or harness result is claimed in this document.
