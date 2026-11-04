# Source-derived question instructions

This small resolver builds the answer type and numerical precision from printed exam instructions. It accepts no answer key. It supports the exact instruction patterns used in the corrected 24-question development release. Other patterns require an explicit source rule instead of a guess. The selected source questions and private release are not included here.

Run the focused tests from the repository root.

```sh
python3 -m unittest discover -s research/evaluation/tests -p test_source_response_types.py -v
```

The tests cover multiple-select instructions, two-decimal numerical rules, exact printed question identifiers and unknown or conflicting rules. [Comparison report](../PILOT120_ABLATION_2026_11_04.md)
