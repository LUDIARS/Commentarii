// A "value" (design 4.3) is any JSON object that carries a `value` key.
// Boundary checks walk raw JSON instead of typed documents so that files failing the
// schema are still inspected (V03-V07 must find problems the schema check also reports).

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValueNode(value: unknown): value is JsonObject {
  return isJsonObject(value) && Object.hasOwn(value, 'value');
}

export interface FoundNode {
  readonly node: JsonObject;
  /** JSON pointer (RFC 6901) from the document root. */
  readonly pointer: string;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/** Every value node in the document. The payload of a value node is not descended into. */
export function findValueNodes(document: unknown): FoundNode[] {
  const found: FoundNode[] = [];
  const visit = (current: unknown, pointer: string): void => {
    if (isValueNode(current)) {
      found.push({ node: current, pointer });
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${pointer}/${index}`));
      return;
    }
    if (!isJsonObject(current)) return;
    for (const [key, child] of Object.entries(current)) visit(child, `${pointer}/${escapePointerSegment(key)}`);
  };
  visit(document, '');
  return found;
}

/** Every object (value node or record) that declares a `knowledge` key, including nested ones. */
export function findKnowledgeHolders(document: unknown): FoundNode[] {
  const found: FoundNode[] = [];
  const visit = (current: unknown, pointer: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${pointer}/${index}`));
      return;
    }
    if (!isJsonObject(current)) return;
    if (Object.hasOwn(current, 'knowledge')) found.push({ node: current, pointer });
    for (const [key, child] of Object.entries(current)) {
      // A value's payload and its source are data, not records with their own boundary.
      if (isValueNode(current) && (key === 'value' || key === 'source')) continue;
      visit(child, `${pointer}/${escapePointerSegment(key)}`);
    }
  };
  visit(document, '');
  return found;
}

/** `/stats/hp` -> `stats.hp`, `/weak_to/0` -> `weak_to` (array positions are not part of a field path). */
export function pointerToFieldPath(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .filter((segment) => !/^\d+$/.test(segment))
    .join('.');
}
