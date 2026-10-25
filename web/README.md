# LlamaJEE.js browser application

The public page has one purpose: load a model and use it to answer a question. Experiment history and technical reports remain in this repository, outside the solver interface.

LlamaJEE.js is Om Patnaik's experimental project for solving JEE Main and Advanced questions. JEE is India's engineering entrance examination. This application lets visitors run the original Qwen3.5-9B model, compare five saved training checkpoints, and try a separate, smaller 0.8B model.

**Current result:** the 9B model and its saved adapters run inside the browser. We have not established that additional training made a generally better JEE solver. Image answers remain unreliable, and phone operation has not been tested.

- **Public site:** [ompatnaik.com/llamajee](https://ompatnaik.com/llamajee/)
- **Alternate address:** [llamajee.ompatnaik.com](https://llamajee.ompatnaik.com/)
- **Evidence:** [9B browser release report](../research/EXPORT09B04_ORIGINAL_BROWSER_RELEASE.md)

## Available models

| Selection | Training represented |
|---|---|
| Qwen3.5-9B unchanged base | Original compressed model, without a project adapter |
| Reliable01 steps 30, 60 and 90 | 30 question families; adapters on 3 language-model layers |
| Coverage experiment, step 60 | 30 question families; adapters on 16 language-model layers |
| Data expansion experiment, step 60 | 60 question families; adapters on 3 language-model layers |
| Qwen3.5-0.8B demo | Separate unchanged model; not a trained 9B checkpoint |

An **adapter** is a small set of trained changes applied to the original model. A **checkpoint** is a saved state from training. A **family** is one source question and its teaching exercises. Layers are the model blocks where the adapters were applied; a step is one training update. The site includes five archived adapter snapshots, not every historical training step.

## Before downloading

Use a browser and device with **WebGPU**, the browser feature that accesses the graphics processor. The 9B release was verified in Chrome on an Apple Silicon Mac with 64 GiB of memory. Minimum memory needs and phone compatibility remain unmeasured.

- **9B:** up to 5.7 GB for text and adapters; image support adds approximately 1.84 GB.
- **0.8B demo:** approximately 850 MB.
- Running either model needs additional memory beyond the download size.

Loading starts only when the visitor chooses to download the selected model. Browser caching can reduce later downloads, but cache persistence is not guaranteed. Questions and images are processed in the browser. Hugging Face serves the model files; visitors do not need an inference API, API key or local Python server.

## What runs in the browser

The 9B model uses a **custom ONNX Runtime WebGPU implementation** with a Transformers.js tokenizer. It preserves the original compressed MLX weights and applies the selected adapter separately. It is not a standard Transformers.js `from_pretrained` package.

The separate 0.8B path uses Transformers.js directly. Both run in a browser worker so the page can display streaming output and stop the operation.

The surrounding page software builds a JEE-specific prompt, including subject and thermodynamics convention hints. It requests givens, a short plan, calculations, checks and a final answer. It checks whether requested sections are present and independently checks one narrow constant-acceleration displacement pattern. It does not verify general mathematics or every reasoning step.

The 9B preview accepts up to 1,536 prepared input tokens. A token is a small piece of text. Images are resized into a 384 × 384 square, so a tightly cropped single question is preferable. Generation has an output limit, a repetition stop and a ten-minute generation deadline. These controls do not guarantee a correct or complete answer.

## What the tests establish

The saved release evidence includes 18 CPU and 10 Chrome sequence comparisons on small synthetic fixtures, plus six adapter activation checks. These test the conversion and whether adapters affect calculation. They are not JEE accuracy benchmarks or proof of agreement on every input.

The public site completed a simple text question with both the base and a trained checkpoint. The original model's errors on two synthetic image fixtures remain. See the [release report](../research/EXPORT09B04_ORIGINAL_BROWSER_RELEASE.md) for outputs, timing limits and evidence.

[Progress charts](../charts/README.md) cover separate 9B training experiments. Their small development sets are not one combined accuracy trend. No trained checkpoint has been selected as a generally better JEE solver.

## Run this application from a repository clone

From the cloned `LlamaJEE.js` repository root, with Node.js and npm installed:

```sh
cd web
npm ci
npm run check
npm run build
npm run dev
```

Open the local URL printed by Vite. This serves the page locally; model computation still happens in the browser. Model downloading and inference do not occur during the unit tests or build. The [original Python/MLX lab](../local_lab/README.md) is a separate application that runs inference on an Apple Silicon Mac and keeps local attempt history.

Dependencies are pinned in `package.json` and `package-lock.json`, including Transformers.js `4.3.0` and ONNX Runtime Web `1.31.0-dev.20260914-8d85527a0`.

## Model identities

- **9B browser package:** [OmTheLast/LlamaJEE-9B-ONNX-WebGPU](https://huggingface.co/OmTheLast/LlamaJEE-9B-ONNX-WebGPU), revision `81f9f6a2591a348994e655a8ea8302c392b9dce2`. The exact download URL is in `archive-config.js`; `VITE_ARCHIVE_MODEL_ROOT` can override it for controlled local checks.
- **Original MLX adapter archive:** [OmTheLast/jee-solver-experimental-mlx-adapters](https://huggingface.co/OmTheLast/jee-solver-experimental-mlx-adapters). These original MLX files do not load directly in a browser.
- **0.8B demo:** [onnx-community/Qwen3.5-0.8B-ONNX](https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX), revision `c0d619322dad7c4441a8841a53fc59772ddddcc0`, set in `harness.js`.

The conversion source is recorded under [conversion_lab](../conversion_lab/). Its documentation describes required original artifacts and reproduction limits; a repository clone does not include the private training workspace or model caches.

## Publish the static site

`npm run build` produces `dist/`. Serve those built files, not the source HTML. Vite uses a relative base so assets resolve under `/llamajee/`.

The canonical deployment is in `OmTheLast/omthelast.github.io`, under `llamajee/`. Copy the built `index.html` and `assets/` there without changing unrelated portfolio files or its root domain configuration. The project repository's `docs/` directory serves the alternate standalone address and retains its separate `CNAME`. Do not copy that `CNAME` into the portfolio deployment.

No private JEE question corpus, answer keys, review records or user attempts are bundled in this website.
