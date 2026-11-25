// Turn model working into readable HTML: LaTeX math via KaTeX plus light Markdown-style structure.
// All non-math text is HTML-escaped; KaTeX runs with trust disabled, so model output cannot inject markup.
import katex from 'katex';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

// $$…$$, \[…\], \(…\) and single-line $…$ (non-empty, not starting or ending with a space).
const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$/g;
const SECTION = /^\s*(?:#{1,6}\s*)?\**\s*(PLAN|GIVEN|GIVENS|METHOD|APPROACH|WORK|WORKING|SOLUTION|STEPS?|CHECK|VERIFICATION|FINAL[ _]ANSWER|ANSWER|RESULT)\s*\**\s*(?::\s*\**\s*(.*?)|)\s*$/i; // a label needs a colon unless it stands alone
const MD_HEADING = /^\s*#{1,6}\s+(.+)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const PLACEHOLDER = /\u0000(\d+)\u0000/g;

export function renderMath(tex, display = false) {
  try {
    return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml' });
  } catch {
    return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`);
  }
}

function extractMath(text) {
  const pieces = [];
  const display = new Set();
  const stripped = text.replace(MATH, (match, block, bracket, paren, inline) => {
    const isDisplay = block !== undefined || bracket !== undefined;
    pieces.push(renderMath(block ?? bracket ?? paren ?? inline, isDisplay));
    if (isDisplay) display.add(pieces.length - 1);
    return `\u0000${pieces.length - 1}\u0000`;
  });
  return { stripped, pieces, display };
}

function inline(text, pieces) {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(PLACEHOLDER, (match, index) => pieces[Number(index)] ?? '');
}

/** Format a full solution (may be partial while streaming). Returns an HTML string. */
export function formatSolution(text) {
  if (!text) return '';
  const { stripped, pieces, display } = extractMath(text.replace(/\r\n?/g, '\n'));
  const out = [];
  let paragraph = [];
  let list = null; // { tag, items }
  const flushParagraph = () => { if (paragraph.length) out.push(`<p>${paragraph.join('<br>')}</p>`); paragraph = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.tag}>`); list = null; };
  const flush = () => { flushParagraph(); flushList(); };

  for (const line of stripped.split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const only = line.trim().match(/^\u0000(\d+)\u0000$/);
    if (only && display.has(Number(only[1]))) { flush(); out.push(`<div class="fmt-math">${pieces[Number(only[1])]}</div>`); continue; }
    const section = line.match(SECTION);
    if (section) {
      flush();
      out.push(`<div class="fmt-heading">${escapeHtml(section[1].replace('_', ' '))}</div>`);
      if (section[2]?.trim()) paragraph.push(inline(section[2], pieces));
      continue;
    }
    const heading = line.match(MD_HEADING);
    if (heading) { flush(); out.push(`<div class="fmt-heading">${inline(heading[1], pieces)}</div>`); continue; }
    const bullet = line.match(BULLET);
    const numbered = !bullet && line.match(NUMBERED);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list?.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(inline(bullet ? bullet[1] : numbered[2], pieces));
      continue;
    }
    flushList();
    paragraph.push(inline(line, pieces));
  }
  flush();
  return out.join('');
}

/** Format a short final answer: mixed text with $…$, or a bare LaTeX expression. */
export function formatInline(text) {
  if (!text) return '';
  if (/\$|\\\(|\\\[/.test(text)) {
    const { stripped, pieces } = extractMath(text);
    return inline(stripped, pieces);
  }
  if (/\\[a-zA-Z]+|\^\{|_\{/.test(text)) return renderMath(text, false);
  return escapeHtml(text);
}
