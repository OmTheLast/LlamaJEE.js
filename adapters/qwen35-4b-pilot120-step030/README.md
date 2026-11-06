# Experimental Qwen3.5-4B JEE adapter — step 30

This folder contains the exact adapter saved after the first 30 training updates of the 4B JEE pilot. An adapter stores the learned changes and must be loaded with the matching base model. The file is 1,697,893 bytes, about 1.70 MB. The pinned base snapshot is downloaded separately and is about 3.06 GB.

This is an **MLX-VLM adapter for Apple Silicon Macs**. It is not ONNX, GGUF, PEFT or a standalone Transformers.js model. Publishing these tensors does not make this checkpoint browser-ready. Use the loader in this folder. The repository's older root loader belongs to the archived 9B adapters.

The required base is [mlx-community/Qwen3.5-4B-4bit](https://huggingface.co/mlx-community/Qwen3.5-4B-4bit/tree/0e7ffd5c629ef7719d4cbc04069232580bfa9d9c), revision `0e7ffd5c629ef7719d4cbc04069232580bfa9d9c`. The loader verifies every required base file and all 18 loaded adapter tensors. It rejects a mismatched snapshot.

Thirty independent training questions supplied 90 related teaching exercises. The training mixture was 60% full solution, 20% method planning and 20% step checking. Only rank-4 adapters on the final three language layers were trained. Original base weights and the vision encoder stayed frozen. The artifact has 423,936 floating-point adapter parameters.

The corrected, reused 24-question development comparison used the same type-specific submission controller for both models.

| Measurement | Unchanged 4B | Step 30 |
|---|---:|---:|
| Correct final answers | 15/24 | 19/24 |
| Correct answers with sufficient working | 12/24 | 12/24 |
| Responses with unproductive repetition | 8/24 | 11/24 |

These are development results. They do not establish performance on fresh JEE questions, improved general reasoning or reliable tutoring. The adapter remains experimental and has not been promoted. [Full comparison](https://github.com/OmTheLast/LlamaJEE.js/blob/fc33551699b7a1d3c46aa9cd2d253440b6348953/research/PILOT120_ABLATION_2026_11_04.md)

To inspect the file without downloading a model, run from this folder.

```sh
python3 load_adapter.py --inspect
python3 -m unittest -v test_package.py
```

For local inference, use a separate Python environment on an Apple Silicon Mac. The pinned dependencies were tested with Python 3.13.11. The first run downloads the base unless the exact snapshot is already cached.

```sh
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python load_adapter.py --question 'Compute 1 + 2. Answer only the number.' --max-tokens 32
```

A question image can be added with `--image question.png`. Use `--base-dir /path/to/pinned-base --offline` to reuse an existing exact snapshot without downloading. The loader provides a direct exploratory response. It does not implement the separate experimental submission controller, so its outputs alone do not reproduce the table above.

The underlying [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B) lists Apache 2.0. The MLX community repository has no separate model card. This release preserves the exact required snapshot identity and contains only the new adapter, metadata and loading utilities. Training questions, private evaluation material, base weights and optimizer state are excluded.

Adapter SHA-256

```text
242e26eb3d61d28983be4cd86fa136cc479fcf86a41e633b2875521523f171cb
```
