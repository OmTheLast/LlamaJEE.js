"""Synthetic examples of the preserved rule, including its historical limitations."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from native_answer_normalizer import normalize


class HistoricalNormalizerTests(unittest.TestCase):
    def test_printed_option_mapping(self):
        q = {'response_type': 'single_select', 'options': {'A': 'first', 'B': 'second', 'C': 'third', 'D': 'fourth'}}
        self.assertEqual(normalize('FINAL_ANSWER:{"option":"2"}', q), {'type': 'options', 'selected_options': ['B']})

    def test_multiple_and_invalid_single_selection(self):
        q = {'response_type': 'multi_select', 'options': {'A': '', 'B': '', 'C': '', 'D': ''}}
        self.assertEqual(normalize('FINAL_ANSWER:{"selected_options":["A","C"]}', q)['selected_options'], ['A', 'C'])
        q['response_type'] = 'single_select'
        self.assertIsNone(normalize('FINAL_ANSWER:{"selected_options":["A","C"]}', q))

    def test_multiline_json_failure_is_preserved(self):
        q = {'response_type': 'single_select', 'options': {'1': '', '2': '', '3': '', '4': ''}}
        self.assertIsNone(normalize('FINAL_ANSWER:\n{\n  "selected_options": "3"\n}', q))

    def test_simple_numeric_extraction_is_not_a_general_math_parser(self):
        q = {'response_type': 'numeric', 'options': {}}
        self.assertEqual(normalize('FINAL_ANSWER:{"value":"-2.5"}', q)['value'], '-2.5')
        # Historical limitation: exponent notation is not interpreted.
        self.assertEqual(normalize('FINAL_ANSWER:{"value":"1e3"}', q)['value'], '1')


if __name__ == '__main__':
    unittest.main()
