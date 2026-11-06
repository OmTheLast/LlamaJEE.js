// The coordinator sets the immutable Hugging Face revision after publication verification.
export const QWEN4B_ROOT = import.meta.env.VITE_QWEN4B_MODEL_ROOT || 'https://huggingface.co/OmTheLast/LlamaJEE-4B-ONNX-WebGPU/resolve/5871c9b3254effce078432f1ea98c4896c4a22d3/';
export const QWEN4B_MODELS = {
  '4b-step30': '4B · trained step 30',
  '4b-base': '4B · unchanged base',
};
export const QWEN4B_REVISION = '0e7ffd5c629ef7719d4cbc04069232580bfa9d9c';
export const STEP30_SHA256 = '242e26eb3d61d28983be4cd86fa136cc479fcf86a41e633b2875521523f171cb';
