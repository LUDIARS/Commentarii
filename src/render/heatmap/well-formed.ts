// A small XML well-formedness check for the SVG the heatmap renderer writes: balanced and
// properly nested tags, quoted attributes, no stray '<' or '&'. Not a full XML parser; enough to
// keep generated pictures loadable (tests and contract C-55).

const NAME = '[A-Za-z_][A-Za-z0-9_.:-]*';
const ATTRIBUTE = `\\s+${NAME}\\s*=\\s*"[^"<]*"`;
const TAG = new RegExp(`^<(/?)(${NAME})((?:${ATTRIBUTE})*)\\s*(/?)>`);
const ENTITY = /^&(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/;

export function wellFormedProblems(xml: string): string[] {
  const stack: string[] = [];
  let index = 0;
  let roots = 0;
  while (index < xml.length) {
    const rest = xml.slice(index);
    if (rest.startsWith('<?')) {
      const end = rest.indexOf('?>');
      if (end < 0) return ['unterminated processing instruction'];
      index += end + 2;
      continue;
    }
    if (rest.startsWith('<')) {
      const match = TAG.exec(rest);
      if (match === null) return [`malformed tag at ${index}`];
      const [whole, closing, name = '', , selfClosing] = match;
      if (closing === '/') {
        if (selfClosing === '/') return [`malformed closing tag </${name}> at ${index}`];
        const open = stack.pop();
        if (open !== name) return [`</${name}> at ${index} closes <${open ?? 'nothing'}>`];
      } else {
        if (stack.length === 0) roots += 1;
        if (selfClosing !== '/') stack.push(name);
      }
      index += whole.length;
      continue;
    }
    if (rest.startsWith('&')) {
      if (!ENTITY.test(rest)) return [`bad entity at ${index}`];
      index += 1;
      continue;
    }
    if (stack.length === 0 && rest[0] !== undefined && !/\s/.test(rest[0])) return [`text outside the root at ${index}`];
    index += 1;
  }
  const problems: string[] = [];
  if (stack.length > 0) problems.push(`unclosed <${stack.join('>, <')}>`);
  if (roots !== 1) problems.push(`expected one root element, found ${roots}`);
  return problems;
}
