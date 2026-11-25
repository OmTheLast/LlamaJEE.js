import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSolution, formatInline } from '../format.js';

test('renders display and inline LaTeX with KaTeX', () => {
  const html = formatSolution('$$P(A \\cup B) = 0.45$$\nSo $0 \\le p \\le 1$.');
  assert.match(html, /class="katex-display"/);
  assert.equal((html.match(/class="katex"/g) || []).length, 2);
  assert.doesNotMatch(html, /\$\$/);
});

test('turns section labels and bullets into structure', () => {
  const html = formatSolution('WORK:\nStep one\n\nCHECK:\n- first\n- second\n\nFINAL_ANSWER:\n0.45');
  assert.equal((html.match(/class="fmt-heading"/g) || []).length, 3);
  assert.match(html, /FINAL ANSWER/);
  assert.match(html, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
});

test('escapes model text so it cannot inject markup', () => {
  const html = formatSolution('<img src=x onerror=alert(1)> and **bold**');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test('leaves unfinished math visible while streaming', () => {
  assert.equal(formatSolution('partial $$x^2'), '<p>partial $$x^2</p>');
});

test('formats short final answers', () => {
  assert.equal(formatInline('9 m'), '9 m');
  assert.match(formatInline('\\frac{1}{2}'), /class="katex"/);
  assert.match(formatInline('$x = 2$'), /class="katex"/);
});
