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

[Portfolio case study](https://ompatnaik.com/jee/) · [Live browser solver](https://ompatnaik.com/llamajee/)

A browser-first JEE solver project by Om Patnaik, with a preserved record of its Qwen model experiments.

The repository contains five archived 9B adapters and the experimental [4B step-30 adapter](adapters/qwen35-4b-pilot120-step030/), with their measured results.

[Original 9B lab setup](local_lab/README.md#run-it) · [Public browser solver: 4B, 9B and 0.8B](https://ompatnaik.com/llamajee/) · [Archived 9B adapters](https://huggingface.co/OmTheLast/jee-solver-experimental-mlx-adapters)

The browser runtime includes the 4B base and step-30 checkpoint for text questions, the original 9B base and five archived adapters, and a separate unchanged 0.8B option. Harness choices reuse the loaded model. The original Apple Silicon / MLX harness remains available locally. Private questions and optimizer state are not published.

By Om Patnaik · repository created September 2026.

## Qwen 4B at steps 30 and 60

After 30 more training problems, the original mixed Qwen 4B went from 19/24 to 18/24 correct on the same JEE question images. The worked-solutions-only model stayed at 17/24, with correct answers backed by sufficient working rising from 10 to 12 on the paired review. Mixed step 30 remains the reference. [Four-checkpoint comparison](research/QWEN4B_TWO_RECIPES_STEP60_2026_11_08.md).

## Qwen 4B training comparison

On the same 24 JEE question images, Qwen 4B answered 15 correctly before training, 19 after mixed training and 17 after training on full solutions alone. The mixed and solve-only adapters trained on the same 30 source problems. Their correct answers with sufficient working numbered 12 and 11, respectively. The mixed adapter remains the current checkpoint. [Training results and paired comparison](research/QWEN4B_SOLVE_ONLY_2026_11_08.md).

## Matched model comparison

On the same 24 question texts with the same H0 submission rule, Qwen 4B step 30 scored 21/24 and LFM3-1.7B scored 18/24. Correct answers with sufficient working were 19/24 and 11/24. Keep Qwen step 30 as the main solver for now. LFM is a smaller candidate for devices that struggle with Qwen, but it returned fewer correct answers and fewer supported solutions on both sets. These results do not establish that step-30 training caused the advantage. [Matched results, new questions and browser measurement](research/MATCHED_TEXT_2026_11_07.md).

## LFM3 side benchmark

Three unchanged LiquidAI models were tested on the same 24 source-reviewed text questions with the existing harnesses. The text model plus short final submission produced 18 correct extracted answers; extra continuation did not improve that total. Formatting failures and unsupported working limit the comparison. These are native Mac results, with no LFM browser integration. [Full results, both scoring views and limitations](research/LFM3_PILOT24_2026_11_06.md) · [Aggregate data](research/LFM3_PILOT24_2026_11_06.json).

## Latest completed harness comparison

On the same 24 reused development questions, the existing type-specific submission gave 15 correct answers for the unchanged 4B and 19 for step 30. Plain continuation gave 17 and 20; targeted recovery gave 16 and 19. The supported improvement was one shared maths problem. Two other base answer gains retained faulty chemistry explanations. No previously correct answers were lost, but some final formats worsened. No further training ran, and these native results are not browser or fresh-question accuracy measurements.

[Harness methods, code and tests](harnesses/) · [Comparison and method history](research/HARNESS_COMPARISON_2026_11_06.md) · [Earlier corrected-input comparison](research/PILOT120_ABLATION_2026_11_04.md).

## Current 4B checkpoint

- [Exact step-30 adapter and native loader](adapters/qwen35-4b-pilot120-step030/), also on [Hugging Face](https://huggingface.co/OmTheLast/LlamaJEE-4B-MLX-Step30). This 1.70 MB MLX adapter requires its pinned 4B base.
- [4B browser package](https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU). This separate custom ONNX package preserves the model weights and adapter factors for browser execution; MLX files do not load directly through Transformers.js.
- [Open the solver](https://ompatnaik.com/llamajee/). The 4B release accepts text questions. Its image export is not suitable for question screenshots; other model options retain their existing image paths.

The public 4B step-30 runtime was checked on one elementary physics question. At the normal 768-token setting it returned the correct 24 m; an artificial 128-token cap produced the wrong 12, which the interface flagged. Both used identical weights, with no new training. The first cold load timed out; later partially cached and warm-cache runs completed. These checks establish public execution, not general JEE accuracy or phone support. [Release report, artifacts and loading limits](research/STEP30_BROWSER_RELEASE_2026_11_06.md).

## Public 9B browser conversion

[Original 9B browser conversion](research/EXPORT09B04_ORIGINAL_BROWSER_RELEASE.md): preserving original MLX compressed weights and separate adapters passed 18 complete CPU and 10 Chrome synthetic comparisons. These checks include the original model's image mistakes; they are not a JEE accuracy benchmark. [Earlier prototype](research/EXPORT09B02_BROWSER_PROTOTYPE.md) and [image diagnosis](research/EXPORT09B03_IMAGE_DIAGNOSTICS.md) remain in the history.

## Public browser deployment

[Open LlamaJEE.js at ompatnaik.com/llamajee/](https://ompatnaik.com/llamajee/).

Select 4B base or step 30, the unchanged 9B base or one of its five experimental snapshots, or the separate 0.8B demo. Models compute on your device; no account, inference API, or local server is needed. The 4B and 9B packages use custom ONNX Runtime WebGPU engines with a Transformers.js tokenizer; they are not standard Transformers.js model loaders.

**Desktop experimental preview:** the full 4B text package is about 3.08 GB; the 9B path uses up to 5.7 GB for text/adapters and about 1.84 GB more for images. Running needs additional memory. Tested on an Apple Silicon Mac with 64 GiB; phones and minimum-memory requirements remain unverified. Image answers can be unreliable, and the 4B path is text-only. No checkpoint has been promoted as a generally better JEE solver.

[4B browser weights](https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU) · [9B browser weights and verification](https://huggingface.co/OmTheLast/LlamaJEE-9B-ONNX-WebGPU) · [Browser source](web/) · [Original adapter archive](https://huggingface.co/OmTheLast/jee-solver-experimental-mlx-adapters).

## Open the original 9B models

The original browser interface uses **browser → local Python server → MLX 9B model on your Mac**. The model runs on the Mac, while the browser displays its output.

| Installation | Browser link | Start it first |
| --- | --- | --- |
| Original development workspace, including its existing private attempt history | [Open original 9B lab](http://127.0.0.1:8765/) | From the JEE project root: `python3 src/jee/start_interactive_lab.py` |
| A clone of this public repository | [Open packaged 9B lab](http://127.0.0.1:8766/) | Follow [local setup](local_lab/README.md#run-it), then run `.venv/bin/python local_lab/start.py` |

Both interfaces offer the unchanged Qwen3.5-9B base and three experimental step-60 adapters: **30 families / 3 layers**, **30 families / 16 layers**, and **60 families / 3 layers**. Five adapter checkpoints are archived in this repository; three are selectable in the interface.

These `127.0.0.1` links connect to **the computer where you open them** and require its local server to be running. GitHub does not host a public 9B inference server. The public site now uses converted ONNX graphs for the original 9B base and all five archived adapters, with the separate 0.8B option retained. Our original local 9B lab uses MLX weights and adapters.

## Install

| Platform / path | Start here |
| --- | --- |
| Browser preview | [Try 4B, the 9B archive or 0.8B](https://ompatnaik.com/llamajee/) |
| Local 9B lab | Follow [local setup](local_lab/README.md) for the pinned base and compatible MLX stack |

Start with `history.csv` and the chart notes without downloading weights. To inspect a 9B adapter, use `load_mlx.py` after installing the compatible stack; it downloads the pinned base separately. None of the latest adapters was promoted as a better solver.

```bash
python -m compileall -q load_mlx.py conversion_lab  # inspect source without model downloads
```

## Why

You need to distinguish a higher answer count from a more reliable problem solver. These experiments preserve answer, procedure, and completion tradeoffs instead of selecting a checkpoint from one number. The reused 12-question development slice is too small for a broad JEE accuracy claim.

## Results

![Strict answer counts, procedure points, and token caps for the unchanged base and five adapters](charts/latest_tradeoffs.svg)

The base scores 7/12 strict answers and 17/24 procedure points; the wider-layer adapter reaches 8/12 answers but falls to 14/24 procedure points. None passes the latest promotion rule.

Rebuild with `python charts/make_charts.py`. [Raw history](history.csv) · [Chart notes](charts/README.md).

## Choose the correct runtime

The original MLX adapters are project-specific artifacts. The browser package preserves their matrices as explicit inputs to custom ONNX graphs; it does not load MLX files directly. The local lab retains local attempt history; the public browser works on the visitor's device.

## 4B training record

The 4B training pilot contains 120 problem families and 360 exercises. The first block used 30 families. Tests with both models held fixed found that a revised submission instruction helped on one development question. A separate check found one answer-count hint in the original inputs. The source-derived answer types were subsequently corrected and tested in the linked ablation. A separate 120-problem test with 20 questions in each subject and exam group remains unused. [First training block](research/PILOT120_FIRST_BLOCK_2026_11_03.md) · [Dataset and percentage graphs](research/PILOT120_DATASET_2026_10_30.md).

## Notes from building it

I kept procedure ratings and completion failures beside strict answers so a narrow gain could not hide regressions. The controlled comparisons led me to retain the unchanged base. I would require fresh confirmation and a reproducible export path before promoting another adapter.

## Commands

```bash
python load_mlx.py --adapter reliable01-step060 --question 'A particle starts from rest at 2 m/s^2 for 3 s. Find displacement.'  # inspect one adapter
python charts/make_charts.py      # rebuild source-labelled plots
python -m unittest discover -s local_lab -p 'test_*.py'  # check the local lab
```

## Verify it yourself

```bash
python -m unittest discover -s local_lab -p 'test_*.py'
python -m compileall -q load_mlx.py conversion_lab
```

Install the pinned `local_lab/requirements.txt` before running the lab tests; they require compatible MLX/MLX-VLM and Metal access. Lab checks do not establish answer correctness or adapter promotion; see `research/` for export limits and promotion gates. Syntax checks can run without downloading the model weights.

## Credits, license and pointers

Built on Qwen3.5-4B and Qwen3.5-9B, their MLX community quantizations, MLX/MLX-VLM, ONNX Runtime WebGPU, and Transformers.js. Research by Om Patnaik with recorded machine-review assistance. Apache-2.0 is declared in the original model metadata; see [the preserved model card](README-DETAILS.md) and upstream terms.

[Full setup, original notes, and project history](README-DETAILS.md).
