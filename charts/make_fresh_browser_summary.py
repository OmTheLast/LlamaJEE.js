"""Render the completed browser comparison from its public aggregate JSON.

Requires Matplotlib. No model downloads, private question data or inference.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'research/FRESH_BROWSER_COMPARISON_2026_11_22.json'
data = json.loads(source.read_text())
total = data['dataset']['questions']
metrics = [('correct', 'Correct final answer'), ('correct_and_supported', 'Correct with sufficient working')]
fig, ax = plt.subplots(figsize=(10.5, 4.3))
fig.subplots_adjust(left=.07, right=.98, top=.77, bottom=.26)
colors = ['#286b82', '#bb7743']
for index, (key, label) in enumerate([('4b-base', 'Unchanged base'), ('4b-step30', 'Original mixed step 30')]):
    values = [data['models'][key][metric] for metric, _ in metrics]
    assert all(0 <= value <= total for value in values)
    positions = [i + (index - .5) * .32 for i in range(len(metrics))]
    bars = ax.bar(positions, values, width=.3, label=label, color=colors[index])
    ax.bar_label(bars, labels=[f'{value}/{total}' for value in values], padding=5, fontsize=12)
ax.set_xticks(range(len(metrics)), [label for _, label in metrics])
ax.set_ylim(0, total)
ax.set_yticks(range(0, total + 1, 6))
ax.set_ylabel('Questions')
ax.spines[['top', 'right']].set_visible(False)
ax.set_axisbelow(True)
ax.grid(axis='y', color='#dae3e6')
fig.suptitle('Fresh browser test: step 30 did not beat the base', x=.07, ha='left', fontsize=17, fontweight='bold')
fig.text(.07, .85, f'{total} shared questions · Chrome WebGPU · same H0 final-answer recovery harness', fontsize=11)
ax.legend(loc='upper center', bbox_to_anchor=(.5, -.15), ncol=2, frameon=False)
fig.text(.07, .025, '22 November 2026 · Small balanced diagnostic; not a general JEE accuracy estimate.', fontsize=10)
for suffix in ('png', 'svg'):
    path = ROOT / 'charts' / ('fresh_browser_summary.' + suffix)
    fig.savefig(path, dpi=160, facecolor='white')
    if suffix == 'svg':
        path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')
plt.close(fig)
print('Rendered charts/fresh_browser_summary.png and .svg from the public aggregate.')
