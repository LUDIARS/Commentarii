import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';

export default { post: (result: boolean, data: unknown, registry: SchemaRegistry) =>
  result === (registry.validate('intent', data).length === 0) };
