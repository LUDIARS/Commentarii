// Small Markdown building blocks shared by every renderer.

/** Escapes text for a table cell: pipes split cells and newlines end rows. */
export function cell(text: string | number): string {
  return String(text).replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');
}

export function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [
    `| ${headers.map(cell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  return lines.join('\n');
}

export function codeBlock(language: string, body: string): string {
  return `\`\`\`${language}\n${body}\n\`\`\``;
}

/** Joins sections with blank lines and ends the document with a newline. */
export function document(sections: readonly string[]): string {
  return `${sections.filter((section) => section !== '').join('\n\n')}\n`;
}

export function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
