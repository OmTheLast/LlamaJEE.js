"""CPU-only release checks. Run with Python's unittest module."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from load_adapter import HERE, inspect_adapter, metadata, verify_base


class AdapterPackageTests(unittest.TestCase):
    def test_released_tensor_identity_and_finiteness(self):
        result = inspect_adapter()
        self.assertEqual(result['arrays'], 18)
        self.assertEqual(result['parameters'], 423936)
        self.assertTrue(result['finite'])

    def test_modified_adapter_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            folder = Path(t)
            shutil.copyfile(HERE / 'jee_adapter.json', folder / 'jee_adapter.json')
            body = bytearray((HERE / 'adapter.safetensors').read_bytes())
            body[-1] ^= 1
            (folder / 'adapter.safetensors').write_bytes(body)
            with self.assertRaises(ValueError):
                inspect_adapter(folder)

    def test_incompatible_or_missing_base_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(ValueError):
                verify_base(Path(t), metadata())


if __name__ == '__main__':
    unittest.main()
