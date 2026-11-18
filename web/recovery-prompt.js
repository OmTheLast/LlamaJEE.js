import { visibleQuestion, contractJSON } from '../harnesses/controller.js';

const FORMATS = {
  single_select: 'Return {"type":"options","selected_options":["label"]} with one printed option label.',
  multi_select: 'Return {"type":"options","selected_options":["label"]} with every supported printed option label.',
  numeric: 'Return {"type":"numeric","value":"decimal string"} following the question’s integer and decimal-place rules.',
  unspecified: 'For printed options return {"type":"options","selected_options":["label"]}. For a number return {"type":"numeric","value":"decimal string"}. For an equation, coordinates or a written answer return {"type":"text","value":"answer"}. Never invent option labels.',
};
const OMITTED = '\n[Middle of the draft omitted to fit. Use only supported results.]\n';

// The question and submission instructions are protected. Only draft text may be shortened.
export function prepareBrowserSubmission({ question, draft, countInputTokens, maxInputTokens }) {
  const visible = visibleQuestion(question);
  const instruction = 'Use the question and saved draft to submit the supported answer. '
    + 'Return only one JSON object. Keep required conditions. Do not repeat the solution. '
    + FORMATS[visible.response_type] + ' If unsupported, return {"type":"abstain"}.';
  const render = text => instruction + '\nQUESTION:\n' + contractJSON(visible) + '\nDRAFT:\n' + text;
  const original = render(draft);
  const originalInputTokens = countInputTokens(original);
  const finish = (userText, omittedStart, omittedEnd) => ({
    userText,
    promptBudget: {
      policy: 'browser-submission-v1', maxInputTokens, originalInputTokens,
      inputTokens: countInputTokens(userText), draftCharacters: [...draft].length,
      omittedDraftCharacters: omittedEnd - omittedStart, omittedRange: [omittedStart, omittedEnd],
    },
  });
  if (originalInputTokens <= maxInputTokens) return finish(original, 0, 0);
  const characters = [...draft];
  const shortened = kept => {
    const head = Math.floor(kept / 4);
    const tail = kept - head;
    return { userText: render(characters.slice(0, head).join('') + OMITTED + characters.slice(characters.length - tail).join('')),
      start: head, end: characters.length - tail };
  };
  let best = shortened(0);
  if (countInputTokens(best.userText) > maxInputTokens) {
    throw Object.assign(new Error('The question and required final-answer context exceed this model’s input limit. The saved working is available below.'), { code: 'CONTEXT_LIMIT' });
  }
  // Search only for a fitting draft. Recount the full chat, including its assistant prefix.
  let lower = 0, upper = characters.length - 1;
  while (lower <= upper) {
    const kept = Math.floor((lower + upper) / 2), candidate = shortened(kept);
    if (countInputTokens(candidate.userText) <= maxInputTokens) {
      best = candidate;
      lower = kept + 1;
    } else upper = kept - 1;
  }
  return finish(best.userText, best.start, best.end);
}
