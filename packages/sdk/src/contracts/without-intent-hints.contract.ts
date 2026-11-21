import type { IntendedItem } from '../domain/documents.ts';
import type { DecisionIntentItem } from '../domain/intent-view.ts';

export default {
  post: (result: DecisionIntentItem, input: IntendedItem) => {
    if ('hints' in result) return 'intent hints crossed the evaluator boundary';
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'hints' && !Object.is(Reflect.get(result, key), value)) return `changed intent field ${key}`;
    }
    return true;
  },
};
