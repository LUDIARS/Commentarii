// Where each map node goes inside one heatmap panel (design 14.H):
//   grid      the size grid; a node is its cell rectangle
//   navgraph  node pos fitted into the panel; a node is a circle (nodes without pos on the bottom row)
//   zones     no geometry, so the zones sit side by side as rectangles in document order

import type { GuideMap } from '../../domain/documents.ts';

export interface NodeShape {
  readonly cx: number;
  readonly cy: number;
  /** Rectangle (grid cell, zone) or circle (navgraph node). */
  readonly rect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly radius?: number;
}

export interface PanelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function gridLayout(map: GuideMap, box: PanelBox): Map<string, NodeShape> {
  const [columns, rows] = map.size ?? [1, 1];
  const size = Math.min(box.width / columns, box.height / rows);
  const shapes = new Map<string, NodeShape>();
  map.nodes.forEach((node, index) => {
    const [column, row] = node.cell ?? [index % columns, Math.floor(index / columns)];
    const x = box.x + column * size;
    const y = box.y + row * size;
    shapes.set(node.id, { cx: x + size / 2, cy: y + size / 2, rect: { x, y, width: size, height: size } });
  });
  return shapes;
}

function groundOf(pos: readonly number[] | undefined): [number, number] | undefined {
  if (pos === undefined || pos.length < 2) return undefined;
  return [pos[0] ?? 0, (pos.length >= 3 ? pos[2] : pos[1]) ?? 0];
}

function navgraphLayout(map: GuideMap, box: PanelBox): Map<string, NodeShape> {
  const placed = map.nodes.flatMap((node) => {
    const ground = groundOf(node.pos);
    return ground === undefined ? [] : [{ id: node.id, ground }];
  });
  const unplaced = map.nodes.filter((node) => groundOf(node.pos) === undefined);
  const radius = 12;
  const inner = { x: box.x + radius, y: box.y + radius, width: box.width - 2 * radius, height: box.height - 2 * radius - (unplaced.length > 0 ? 3 * radius : 0) };
  const xs = placed.map((node) => node.ground[0]);
  const ys = placed.map((node) => node.ground[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(maxX > minX ? inner.width / (maxX - minX) : 1, maxY > minY ? inner.height / (maxY - minY) : 1);
  const shapes = new Map<string, NodeShape>();
  for (const node of placed) {
    shapes.set(node.id, { cx: inner.x + (node.ground[0] - minX) * scale, cy: inner.y + (node.ground[1] - minY) * scale, radius });
  }
  unplaced.forEach((node, index) => {
    shapes.set(node.id, { cx: box.x + radius + index * 3 * radius, cy: box.y + box.height - radius, radius });
  });
  return shapes;
}

function zonesLayout(map: GuideMap, box: PanelBox): Map<string, NodeShape> {
  const width = box.width / Math.max(1, map.nodes.length);
  const shapes = new Map<string, NodeShape>();
  map.nodes.forEach((node, index) => {
    const x = box.x + index * width;
    shapes.set(node.id, { cx: x + width / 2, cy: box.y + box.height / 2, rect: { x: x + 2, y: box.y, width: width - 4, height: box.height } });
  });
  return shapes;
}

export function layoutMap(map: GuideMap, box: PanelBox): Map<string, NodeShape> {
  switch (map.kind) {
    case 'grid':
      return gridLayout(map, box);
    case 'navgraph':
      return navgraphLayout(map, box);
    case 'zones':
      return zonesLayout(map, box);
  }
}
