// Minimal SVG building by string assembly (no dependency, design 14.H): escaped text and
// attributes, elements, and the document wrapper.

export type Attributes = Readonly<Record<string, string | number | undefined>>;

export function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function number(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function attributes(attrs: Attributes): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${typeof value === 'number' ? number(value) : escapeXml(String(value))}"`)
    .join('');
}

/** <name attrs/> when there is no content, else <name attrs>content</name>. */
export function element(name: string, attrs: Attributes, content: readonly string[] | string = []): string {
  const body = typeof content === 'string' ? content : content.join('');
  return body === '' ? `<${name}${attributes(attrs)}/>` : `<${name}${attributes(attrs)}>${body}</${name}>`;
}

export function text(attrs: Attributes, value: string): string {
  return element('text', attrs, escapeXml(value));
}

export function svgDocument(width: number, height: number, title: string, content: readonly string[]): string {
  return `${element(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', width, height, viewBox: `0 0 ${number(width)} ${number(height)}`, 'font-family': 'sans-serif', 'font-size': 11 },
    [element('title', {}, escapeXml(title)), element('rect', { class: 'background', x: 0, y: 0, width, height, fill: '#ffffff' }), ...content],
  )}\n`;
}

/** 0..1 -> a white-to-orange fill. */
export function heatColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  const channel = (from: number, to: number): string => Math.round(from + (to - from) * r).toString(16).padStart(2, '0');
  return `#${channel(255, 230)}${channel(255, 85)}${channel(255, 13)}`;
}
