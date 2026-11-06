"""Load this exact experimental 4B MLX adapter. --inspect needs only Python."""
from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

HERE = Path(__file__).resolve().parent


def file_hash(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def metadata(folder=HERE):
    return json.loads((Path(folder) / 'jee_adapter.json').read_text())


def inspect_adapter(folder=HERE):
    folder = Path(folder)
    info = metadata(folder)
    path = folder / 'adapter.safetensors'
    if file_hash(path) != info['adapter_sha256'] or path.stat().st_size != info['adapter_bytes']:
        raise ValueError('Adapter file differs from the released step-30 artifact')
    with path.open('rb') as f:
        header_size = struct.unpack('<Q', f.read(8))[0]
        if header_size > 100_000:
            raise ValueError('Unexpected tensor header size')
        header = json.loads(f.read(header_size))
        data = f.read()
    tensors = {k:v for k,v in header.items() if k != '__metadata__'}
    expected = {}
    for layer in info['layer_indices']:
        for proj in info['mlp_projections']:
            inputs, outputs = (9216, 2560) if proj == 'down_proj' else (2560, 9216)
            for suffix, shape in [('lora_a', [inputs, 4]), ('lora_b', [4, outputs])]:
                expected[f'language_model.model.layers.{layer}.mlp.{proj}.{suffix}'] = shape
    if set(tensors) != set(expected):
        raise ValueError('Unexpected adapter tensor names')
    spans = []
    count = 0
    for name, shape in expected.items():
        tensor = tensors[name]
        if tensor['dtype'] != 'F32' or tensor['shape'] != shape:
            raise ValueError('Unexpected tensor shape or precision: ' + name)
        start, end = tensor['data_offsets']
        if not 0 <= start < end <= len(data) or end - start != math.prod(shape) * 4:
            raise ValueError('Invalid tensor byte range')
        values = array('f', data[start:end])
        if sys.byteorder != 'little':
            values.byteswap()
        if not all(math.isfinite(x) for x in values):
            raise ValueError('Nonfinite adapter values')
        spans.append((start, end))
        count += len(values)
    spans.sort()
    if spans[0][0] != 0 or spans[-1][1] != len(data) or any(a[1] != b[0] for a,b in zip(spans, spans[1:])):
        raise ValueError('Overlapping or unaccounted tensor bytes')
    if count != info['adapter_parameters'] or len(tensors) != 18:
        raise ValueError('Unexpected adapter parameter count')
    return {'adapter_sha256': file_hash(path), 'bytes': path.stat().st_size,
            'arrays': len(tensors), 'parameters': count, 'precision': 'float32', 'finite': True}


def verify_base(model_dir, info):
    model_dir = Path(model_dir)
    for name, expected in info['base']['files_sha256'].items():
        if Path(name).name != name or not (model_dir / name).is_file():
            raise ValueError('Missing pinned base file: ' + name)
        if file_hash(model_dir / name) != expected:
            raise ValueError('Base snapshot differs from pinned 4B revision: ' + name)
    return model_dir


def load_adapter(*, base_dir=None, offline=False, folder=HERE):
    """Return (model, processor) with all 18 released LoRA arrays verified."""
    from importlib.metadata import version
    import mlx.core as mx
    from huggingface_hub import snapshot_download
    from mlx_vlm.trainer.lora_layers import LoRALinear
    from mlx_vlm.utils import load

    folder = Path(folder)
    inspect_adapter(folder)
    info = metadata(folder)
    for name in ('mlx', 'mlx-vlm', 'transformers'):
        if version(name) != info['tested_runtime'][name]:
            raise RuntimeError(f'Use the tested runtime {name}=={info["tested_runtime"][name]}')
    if not mx.metal.is_available():
        raise RuntimeError('This loader requires an Apple Silicon Mac with Metal')
    if base_dir is None:
        base_dir = snapshot_download(repo_id=info['base']['repo'], revision=info['base']['revision'],
            allow_patterns=list(info['base']['files_sha256']), local_files_only=offline)
    model_dir = verify_base(base_dir, info)
    mx.set_memory_limit(40 * 2**30)
    mx.set_cache_limit(2 * 2**30)
    mx.random.seed(0)
    model, processor = load(str(model_dir), trust_remote_code=False)
    model.freeze()
    weights = mx.load(str(folder / 'adapter.safetensors'))
    for layer_id in info['layer_indices']:
        mlp = model.language_model.layers[layer_id].mlp
        for projection in info['mlp_projections']:
            layer = LoRALinear.from_base(getattr(mlp, projection), r=info['rank'],
                scale=info['scale'], dropout=info['dropout'])
            setattr(mlp, projection, layer)
            for part in ('lora_a', 'lora_b'):
                name = f'language_model.model.layers.{layer_id}.mlp.{projection}.{part}'
                if weights[name].shape != getattr(layer, part).shape:
                    raise ValueError('Adapter shape differs from this base model')
    model.load_weights(list(weights.items()), strict=False)
    for layer_id in info['layer_indices']:
        for projection in info['mlp_projections']:
            for part in ('lora_a', 'lora_b'):
                name = f'language_model.model.layers.{layer_id}.mlp.{projection}.{part}'
                actual = getattr(getattr(model.language_model.layers[layer_id].mlp, projection), part)
                if not mx.array_equal(actual, weights[name]).item():
                    raise ValueError('Loaded adapter differs from the released tensor')
    model.freeze()
    model.eval()
    return model, processor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inspect', action='store_true', help='Check this adapter without loading a model')
    parser.add_argument('--base-dir', type=Path, help='Use an existing exact pinned MLX base snapshot')
    parser.add_argument('--offline', action='store_true', help='Never download the base snapshot')
    parser.add_argument('--question', help='Text question for an exploratory direct response')
    parser.add_argument('--image', type=Path, help='Optional PNG or JPEG question image')
    parser.add_argument('--max-tokens', type=int, default=1024)
    args = parser.parse_args()
    if args.inspect:
        print(json.dumps(inspect_adapter(), indent=2))
        return
    if not args.question and not args.image:
        parser.error('Provide --question and/or --image, or use --inspect')
    if not 1 <= args.max_tokens <= 4096:
        parser.error('--max-tokens must be between 1 and 4096')
    if args.image and not args.image.is_file():
        parser.error('The image does not exist')
    model, processor = load_adapter(base_dir=args.base_dir, offline=args.offline)
    from mlx_vlm.generate import stream_generate
    content = ([{'type': 'image'}] if args.image else []) + [{'type': 'text', 'text': args.question or 'Solve the question shown in the image.'}]
    prompt = processor.apply_chat_template([{'role': 'user', 'content': content}],
        tokenize=False, add_generation_prompt=True, enable_thinking=False)
    for part in stream_generate(model, processor, prompt,
            image=[str(args.image)] if args.image else [], max_tokens=args.max_tokens,
            temperature=0, enable_thinking=False, skip_special_tokens=True):
        print(part.text or '', end='', flush=True)
    print()


if __name__ == '__main__':
    main()
