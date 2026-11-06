# LlamaJEE.js browser solver

Load a model, choose how it should work through the question, and enter a problem. The model runs on your device. The public solver has no inference API and does not require an API key.

- [Open the solver](https://ompatnaik.com/llamajee/)
- [Alternate address](https://llamajee.ompatnaik.com/)
- [Harness code and completed comparison](../harnesses/README.md)

## Models

| Choice | What it loads | Question input |
|---|---|---|
| 4B trained step 30 | Pinned Qwen3.5-4B base plus the exact saved step-30 adapter | Text |
| 4B unchanged base | The same base decoder with zero adapter changes | Text |
| 9B unchanged base and five saved checkpoints | Existing Qwen3.5-9B browser archive | Text or image |
| 0.8B separate demo | Separate unchanged Qwen3.5-0.8B model | Text or image |

An adapter is a small set of trained changes applied to the original model. A checkpoint is a saved training state. The 9B archive preserves Reliable01 steps 30, 60 and 90, the 16-layer coverage step 60, and the 60-family data-expansion step 60. These are experimental models; a completed answer can still be wrong.

The 4B browser package is up to 3.1 GB. The 9B text package is up to 5.7 GB, with another 1.84 GB for its optional image encoder. The 0.8B demo is about 850 MB. Browser caching may reduce repeat downloads; storage persistence is not guaranteed. Runtime memory exceeds file size. Desktop Chrome or Edge with WebGPU is recommended; phone compatibility is not established.

The 4B package's old engineering image graph was fixed to a 64×64 synthetic fixture. It is not offered as a question-image reader. Paste the full question as text, or select a 9B/0.8B option for an image. Existing 9B images are fitted into 384×384 pixels; small labels may become unreadable. Image answers remain unverified.

## Solving approaches

These options use the same selected model. Changing the approach does not reload its weights. Switching between 4B base and step 30 changes only the small adapter factors; switching model sizes releases the previous worker.

- **Original:** one bounded response.
- **H0, final-answer recovery (default):** if the response reaches its token cap, ask for a typed final answer.
- **H1, continuation:** on a token cap, continue the original response, then request a final answer.
- **H2, remaining task:** on a token cap, ask for a short task state, attempt that task, and request a final answer. An invalid state falls back to the H0 submission policy, with a warning.

Recovery is attempted only after a token cap. A repetition stop, cancellation, time limit or oversized input is not presented as successful recovery. The page preserves the available working and warns that it is unverified. Typed numeric answers and option labels appear plainly in the answer card; the original response stays visible below.

These are browser adaptations of the completed native comparison. Browser prompts, precision, limits and image handling differ. Native development-set accuracy is not a browser accuracy claim. The interface checks formatting, flags malformed recovery submissions, and checks one narrow constant-acceleration example; it does not verify general mathematics or science.

## Limits and stopping

The direct output choices are 128, 384, **768 by default**, or 1,280 tokens. A token is a small piece of text. H0 may add 96 output tokens. H1 allows 512 continuation tokens plus 96 submission tokens. H2 allows 96 state tokens, 416 recovery tokens and 96 submission tokens, with the documented fallback policy.

The 4B runtime accepts at most 1,536 prepared input tokens per stage, including any continued assistant response. It rejects larger inputs rather than truncating the question. Each 4B stage is bounded to 120 seconds; the state and submission stages have their shorter 90-second limits. Repetition detection also stops recurring token spans. These are application limits, not claims about the model's maximum context.

New recovery approaches on the older models also use bounded stages. The original 9B one-response option retains its earlier ten-minute generation limit and 1,536-token input bound. The original 0.8B option has a ten-minute controller bound.

**Stop generation** requests cancellation and keeps the loaded model for another question. **Release model** terminates its worker and releases model memory; use this during a download or if the runtime stops responding. Changing the model or approach is disabled while a run is active. Cancellation is cooperative between GPU operations, so an operation already submitted may finish first.

## Runtime and exact model files

Both 4B and 9B use custom ONNX Runtime WebGPU decoders with Transformers.js tokenizers. They preserve the compressed source weights and supply adapters separately. They are not standard Transformers.js `from_pretrained` packages. The 0.8B path uses Transformers.js directly.

- [4B ONNX browser package](https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU), pinned revision `5871c9b3254effce078432f1ea98c4896c4a22d3` in `qwen4b-config.js`.
- [9B ONNX browser package](https://huggingface.co/OmTheLast/LlamaJEE-9B-ONNX-WebGPU), pinned revision `81f9f6a2591a348994e655a8ea8302c392b9dce2` in `archive-config.js`.
- [0.8B ONNX demo](https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX), pinned revision `c0d619322dad7c4441a8841a53fc59772ddddcc0` in `harness.js`.

The 4B runtime checks the published package identity and all 18 step-30 factor hashes before using them. Conversion checks and simple browser questions do not establish agreement on every input or general JEE accuracy.

## Run and publish

From a repository clone:

```sh
cd web
npm ci
npm run check
npm run build
npm run dev
```

The local web server only serves static assets. Inference remains in the browser. Tests and builds do not download or run a model. `VITE_QWEN4B_MODEL_ROOT` and `VITE_ARCHIVE_MODEL_ROOT` allow explicit model-root overrides for controlled tests; ordinary builds use the pinned public URLs.

`npm run build` produces `dist/`. The relative asset base supports `/llamajee/`. The canonical deployment is `OmTheLast/omthelast.github.io/llamajee/`; copy only the built page and assets there. The project repository's `docs/` serves the alternate address and retains its own `CNAME`. Do not copy that `CNAME` into the portfolio site.

No private question corpus, answer keys, review records or user attempts are bundled with this application.
