"""Derive a solver response contract from printed exam instructions only.

This resolver deliberately has no answer-key argument. Supply the applicable
section header, not a whole paper containing several different section rules.
Unknown or conflicting instructions require a source review instead of a guess.
"""

import copy
import re


def compact(text):
    return " ".join(text.split())


def source_contract(section_text, *, exam, item_marker_text=None, source_item_id=None):
    text = compact(section_text).casefold()
    if exam == "main":
        if not source_item_id or not re.fullmatch(r"\d+", source_item_id):
            raise ValueError("A printed Main question identifier is required")
        marker = compact(item_marker_text or "")
        if not re.search(r"Question Type\s*:\s*MCQ\s*Question ID\s*:\s*"
                         + re.escape(source_item_id) + r"\b", marker):
            raise ValueError("The printed MCQ marker does not match this question")
        if "one option corresponding to the correct answer" not in text:
            raise ValueError("Unrecognized Main selection instruction")
        response_type = "single_select"
    elif exam == "advanced":
        matches = []
        if "only one of these four options" in text:
            matches.append("single_select")
        if "one or more than one" in text:
            matches.append("multi_select")
        if "the answer to each question is a numerical value" in text:
            matches.append("numeric")
        if len(matches) != 1:
            raise ValueError("Unknown or conflicting Advanced section instructions")
        response_type = matches[0]
    else:
        raise ValueError("Unsupported exam instructions")

    if response_type == "numeric":
        if "truncate/round-off the value to two decimal places" not in text:
            raise ValueError("Numerical precision needs a recognized printed rule")
        answer_format = {"require_integer": False, "max_decimal_places": 2}
    else:
        answer_format = {"require_integer": False, "max_decimal_places": None}
    return {"response_type": response_type, "answer_format": answer_format}


def apply_source_contracts(manifest, contracts):
    """Copy a solver manifest and replace only its two source-derived fields."""
    ids = [q["id"] for q in manifest["items"]]
    if len(set(ids)) != len(ids) or set(ids) != set(contracts):
        raise ValueError("Source contracts must match every solver item exactly once")
    result = copy.deepcopy(manifest)
    for item in result["items"]:
        contract = contracts[item["id"]]
        if set(contract) != {"response_type", "answer_format"}:
            raise ValueError("Only the source-derived contract fields are accepted")
        item.update(copy.deepcopy(contract))
    return result
