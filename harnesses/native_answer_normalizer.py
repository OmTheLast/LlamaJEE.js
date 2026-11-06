"""Historical deterministic submission normalizer used by the native comparison.

This is a preserved formatting rule, not a scientific answer checker. It receives
only raw output and the visible question contract; no answer key or data loader.
Known historical limitations, including single-line JSON and simple decimal
extraction, are intentionally preserved for inspection of the reported results.
"""
import json
import re

QUOTED_FIELD=re.compile(r'"(?:option|answer|value)"\s*:\s*"?([^",}\n]+)',re.I)
AFTER_PREFIX=re.compile(r'^FINAL_ANSWER:\s*([^\n]+)',re.I)


def choice(raw: str):
    match=AFTER_PREFIX.search(raw.strip())
    if not match: return None
    value=match.group(1).strip().strip('`')
    if value.startswith('{'):
        try:
            obj=json.loads(value)
            for key in ('selected_options','option','answer','value'):
                if key in obj: return obj[key]
        except json.JSONDecodeError:
            match=QUOTED_FIELD.search(raw)
            return match.group(1).strip() if match else None
    return value.strip('"\' ')


def labels(value, available: list[str]):
    values=value if isinstance(value,list) else re.split(r'\s*,\s*|\s+and\s+',str(value))
    out=[]
    for raw in values:
        x=str(raw).strip().upper()
        if x in available: label=x
        elif x in ('A','B','C','D') and all(y.isdigit() for y in available): label=available[ord(x)-ord('A')]
        elif x.isdigit() and not all(y.isdigit() for y in available) and 1 <= int(x) <= len(available): label=available[int(x)-1]
        else: return None
        if label not in out: out.append(label)
    return out


def normalize(raw: str, item: dict):
    value=choice(raw)
    if value is None: return None
    if item['response_type']=='numeric':
        match=re.search(r'[-+]?\d+(?:\.\d+)?',str(value))
        return {'type':'numeric','value':match.group(0)} if match else None
    selected=labels(value,list(item['options']))
    if not selected or (item['response_type']=='single_select' and len(selected)!=1): return None
    return {'type':'options','selected_options':selected}

