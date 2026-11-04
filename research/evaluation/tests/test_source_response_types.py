"""Guard against answer-derived option counts and numerical precision."""

import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src/jee"))
from source_response_types import apply_source_contracts, source_contract


class SourceContractTests(unittest.TestCase):
    def test_multi_select_does_not_depend_on_existing_key_derived_type(self):
        contract = source_contract("ONE OR MORE THAN ONE of these four options",
                                   exam="advanced")
        for old_type in ("single_select", "multi_select", "numeric"):
            old = {"items": [{"id": "fixture", "response_type": old_type,
                              "answer_format": {"require_integer": True,
                                                "max_decimal_places": 0},
                              "statement": "Preserve this", "assets": []}]}
            before = copy.deepcopy(old)
            new = apply_source_contracts(old, {"fixture": contract})
            self.assertEqual(new["items"][0]["response_type"], "multi_select")
            self.assertEqual(old, before)
            self.assertEqual(new["items"][0]["statement"], "Preserve this")

    def test_numeric_precision_is_not_inferred_from_integer_answers(self):
        contract = source_contract(
            "The answer to each question is a NUMERICAL VALUE. If the numerical "
            "value has more than two decimal places, truncate/round-off the value "
            "to TWO decimal places.", exam="advanced")
        self.assertEqual(contract["answer_format"],
                         {"require_integer": False, "max_decimal_places": 2})

    def test_unknown_conflicting_or_unbound_rule_fails(self):
        for text in ("Pick the correct answer", "ONLY ONE of these four options. "
                     "ONE OR MORE THAN ONE", "The answer to each question is a NUMERICAL VALUE."):
            with self.assertRaises(ValueError):
                source_contract(text, exam="advanced")
        with self.assertRaises(ValueError):
            source_contract("one option corresponding to the correct answer", exam="main",
                            item_marker_text="Question Type : MCQ Question ID : 123", source_item_id="124")
        with self.assertRaises(ValueError):
            apply_source_contracts({"items": [{"id": "unreviewed"}]}, {})

    def test_main_exact_marker_and_bulletin(self):
        contract = source_contract("one option corresponding to the correct answer", exam="main",
                                   item_marker_text="Question Type : MCQ Question ID : 123", source_item_id="123")
        self.assertEqual(contract["response_type"], "single_select")


if __name__ == "__main__":
    unittest.main()
