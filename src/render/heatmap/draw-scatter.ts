// The two good-play axes as an SVG scatter plot (design 8.5): x = breadth (solutions that
// worked), y = confusion depth, one point per stage x persona, coloured per persona. Both axes
// are always drawn together; the picture states positions, not verdicts.

import { element, svgDocument, text } from './svg.ts';

export interface ScatterPoint {
  readonly stage: string;
  readonly persona: string;
  readonly breadth: number;
  readonly confusionDepth: number;
}

const WIDTH = 520;
const HEIGHT = 360;
const LEFT = 56;
const RIGHT = 150;
const TOP = 28;
const BOTTOM = 44;
const PALETTE = ['#2b6cb0', '#dd6b20', '#2f855a', '#805ad5', '#c53030', '#319795', '#b7791f', '#4a5568'];

export function drawScatter(title: string, points: readonly ScatterPoint[]): string {
  const personas = [...new Set(points.map((point) => point.persona))].sort();
  const colorOf = new Map(personas.map((persona, index) => [persona, PALETTE[index % PALETTE.length] ?? '#4a5568']));
  const maxX = Math.max(1, ...points.map((point) => point.breadth));
  const maxY = Math.max(1, ...points.map((point) => point.confusionDepth));
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const xOf = (value: number): number => LEFT + (value / maxX) * plotWidth;
  const yOf = (value: number): number => TOP + plotHeight - (value / maxY) * plotHeight;
  const axes = [
    element('line', { class: 'axis', x1: LEFT, y1: TOP + plotHeight, x2: LEFT + plotWidth, y2: TOP + plotHeight, stroke: '#333333' }),
    element('line', { class: 'axis', x1: LEFT, y1: TOP, x2: LEFT, y2: TOP + plotHeight, stroke: '#333333' }),
    text({ x: LEFT + plotWidth / 2, y: HEIGHT - 10, 'text-anchor': 'middle' }, `解法の広さ (breadth) 0〜${maxX}`),
    text({ x: 14, y: TOP + plotHeight / 2, transform: `rotate(-90 14 ${TOP + plotHeight / 2})`, 'text-anchor': 'middle' }, `迷いの深さ (confusion depth) 0〜${maxY}`),
  ];
  const marks = points.map((point) =>
    element('g', { class: 'point', 'data-stage': point.stage, 'data-persona': point.persona, 'data-breadth': point.breadth, 'data-confusion-depth': point.confusionDepth }, [
      element('circle', { cx: xOf(point.breadth), cy: yOf(point.confusionDepth), r: 5, fill: colorOf.get(point.persona) ?? '#4a5568' }),
      text({ x: xOf(point.breadth) + 7, y: yOf(point.confusionDepth) - 6, 'font-size': 9, fill: '#333333' }, point.stage.replace(/^stage:[^:]+:/, '')),
    ]),
  );
  const legend = personas.map((persona, index) =>
    element('g', { class: 'legend', 'data-persona': persona }, [
      element('circle', { cx: WIDTH - RIGHT + 16, cy: TOP + 10 + index * 18, r: 5, fill: colorOf.get(persona) ?? '#4a5568' }),
      text({ x: WIDTH - RIGHT + 26, y: TOP + 14 + index * 18 }, persona),
    ]),
  );
  return svgDocument(WIDTH, HEIGHT, title, [...axes, ...marks, ...legend]);
}
