// C-92 readFixtureReplay(name): the returned text is a replay whose every line is JSON, opening
// with a header line and closing with a footer line.

function lineTypes(text: string): (string | undefined)[] | string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const types: (string | undefined)[] = [];
  for (const [index, line] of lines.entries()) {
    try {
      types.push((JSON.parse(line) as { type?: string }).type);
    } catch {
      return `line ${index + 1} is not JSON`;
    }
  }
  return types;
}

export default {
  post: (text: string) => {
    const types = lineTypes(text);
    if (typeof types === 'string') return types;
    if (types.length < 2) return 'replay has fewer than two lines';
    if (types[0] !== 'header') return 'first line is not the header';
    return types.at(-1) === 'footer' || 'last line is not the footer';
  },
};
