---
license: apache-2.0
base_model:
  - mlx-community/Qwen3.5-9B-4bit
  - mlx-community/Qwen3.5-4B-4bit
pipeline_tag: image-text-to-text
tags:
  - mlx
  - lora
  - qwen3.5
  - jee
  - experimental
---

<h1 align="center">LlamaJEE.js</h1>

**Run an experimental JEE solver in your browser and inspect the evidence behind its trained models.**

[Open the browser solver](https://ompatnaik.com/llamajee/) · [Portfolio case study](https://ompatnaik.com/jee/)

Desktop WebGPU preview; models run on your device without an account or inference API. Downloads are large; phone support is not established.

By Om Patnaik · started September 2026 · findings updated 25 November 2026.

## Install

| Platform | First useful action |
|---|---|
| Browser | [Open the solver](https://ompatnaik.com/llamajee/), choose 4B base or step 30, load it, then enter a complete text question. |
| Apple Silicon Mac | Follow the [original local 9B lab setup](local_lab/README.md#run-it), then open its local browser interface. |

The browser displays the answer and saved working. The 4B download is about 3.08 GB; running needs additional memory. To inspect the project without downloading weights, start with the results below and [experiment history](EXPERIMENT_HISTORY.md).

## Why

You need a solver that reaches the right answer with working you can check. This project compares model training and the surrounding answering code separately. It is an experimental tool, not a proven JEE tutor.

## Results

**On the fresh matched browser test, the unchanged 4B scored 12/24 and trained step 30 scored 10/24.** Step 30 lost two correct answers and gained none. This does not support an improvement claim, and the small difference does not establish general model collapse.

Here, **base** means the pretrained Qwen3.5-4B model without this project's trained adapter. It still uses the pinned compressed weights, browser conversion and answering harness. **Step 30** adds the small set of learned weight adjustments, called a LoRA adapter, after 30 training updates. It is not a model trained from scratch.

![Base and step-30 correct answers: 12 versus 10; correct with sufficient working: 9 versus 8, out of 24](charts/fresh_browser_summary.png)

22 November 2026: the same 24 text questions, four per subject/exam group, ran in Chrome with the same H0 harness. H0 requests a final answer when the first response reaches its output limit. Correct answers with sufficient working were 9/24 and 8/24. Both models reached the initial limit on 16 questions; repeated, unproductive working appeared in two base answers and four trained answers.

Rebuild with `python charts/make_fresh_browser_summary.py` (requires Matplotlib). [Public aggregate data](research/FRESH_BROWSER_COMPARISON_2026_11_22.json) · [Conditions, review rules and limitations](research/FRESH_BROWSER_COMPARISON_2026_11_22.md).

The questions were new to the recorded project evaluation history, not guaranteed absent from Qwen's pretraining. This small diagnostic is not a full-syllabus accuracy estimate. No checkpoint has been promoted as a generally better JEE solver.

## Compare mistakes with the training data

The earlier composition graph covers **120 prepared problem families and 360 exercises**. The tested step-30 checkpoint had consumed **30 families and 90 related exercises**, with five families per subject/exam group. Its source problems included 19 single-choice, four multiple-choice, six numerical and one matching problem; the test contained eight of each first three formats.

Step 30's 14 misses included scientific mistakes, unfinished solutions, abstentions and final-answer delivery errors. Seven misses occurred among 11 test questions with a primary chapter represented in training; seven occurred among 13 without one. Topic overlap does not establish practice on the exact method, and missing coverage alone does not explain the failures. [Error types, chapter comparison and percentage graph](research/ERRORS_AND_TRAINING_COVERAGE_2026_11_24.md).

## Choose a model and runtime

The public solver offers the 4B base and step-30 checkpoint for text, the 9B base and five archived adapters, and a separate unchanged 0.8B option. Harness choices reuse the loaded model. The 4B and 9B engines use custom ONNX Runtime WebGPU graphs with a Transformers.js tokenizer; they do not load MLX files directly. [Browser source and setup](web/README.md) · [4B browser package](https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU) · [9B browser package](https://huggingface.co/OmTheLast/LlamaJEE-9B-ONNX-WebGPU).

For native Mac use, the [4B adapter and loader](adapters/qwen35-4b-pilot120-step030/) require the pinned MLX base. The [original 9B lab](local_lab/README.md) runs inference in a local Python server and shows the result in your browser. The 9B browser path can download up to 5.7 GB for text/adapters plus about 1.84 GB for images. It was tested on an Apple Silicon Mac with 64 GiB; minimum memory and phone support are not established. Image answers can be unreliable.

## Read the earlier comparisons

The older **19/24** came from reused development questions under native Mac conditions. It cannot be compared with the fresh browser **10/24** as a fall on the same test. Earlier mixed/solution-only training, step-60 continuation, LFM comparisons and harness experiments remain in the [experiment history](EXPERIMENT_HISTORY.md), with their separate inputs and limitations. The archived [9B tradeoff charts](charts/README.md) remain available too.

## Notes from building it

I kept wrong answers and completion failures beside the successes. I learned that a procedure heading or a valid answer format does not make the reasoning correct. I preserved the unchanged model as a control and published the fresh negative result. I also separated the prepared curriculum from the examples each checkpoint actually consumed.

## Commands

```bash
python charts/make_fresh_browser_summary.py            # rebuild the current comparison chart
python charts/make_charts.py                           # rebuild archived 9B charts
python -m compileall -q load_mlx.py conversion_lab      # check Python syntax without model downloads
```

## Verify it yourself

```bash
python -m unittest discover -s local_lab -p 'test_*.py'
python -m compileall -q load_mlx.py conversion_lab
```

Install the pinned `local_lab/requirements.txt` before running lab tests; they need compatible MLX/MLX-VLM and Metal access. The browser comparison verified the paired requests, pinned model-file identities and adapter application; it did not establish full native/browser equivalence. [9B conversion checks](research/EXPORT09B04_ORIGINAL_BROWSER_RELEASE.md) and [4B release checks](research/STEP30_BROWSER_RELEASE_2026_11_06.md) document the tested paths and their limits.

## Credits, license and pointers

Built on Qwen3.5, the MLX community quantizations, MLX/MLX-VLM, ONNX Runtime WebGPU and Transformers.js. Apache-2.0 is declared in the preserved model metadata; see [the model card](README-DETAILS.md) and upstream terms. Private source questions, keys, reviews and optimizer states are not included in this repository.

[Project history](EXPERIMENT_HISTORY.md) · [Full setup and original model notes](README-DETAILS.md) · [Harness methods and tests](harnesses/) · [4B MLX weights](https://huggingface.co/OmTheLast/LlamaJEE-4B-MLX-Step30) · [9B adapter archive](https://huggingface.co/OmTheLast/jee-solver-experimental-mlx-adapters).
