// C-104 renderRulebook(bundle): the page names every action with its precondition expression and
// draws each fsm behavior model as a Mermaid stateDiagram.

import type { Bundle } from '@ludiars/commentarii-sdk/types';

export default {
  post: (page: string, bundle: Bundle) => {
    for (const { doc } of bundle.rulebook.actions) {
      if (!page.includes(doc.id)) return `${doc.id} is missing`;
      if (!page.includes(doc.pre)) return `pre of ${doc.id} is missing`;
    }
    const fsm = bundle.rulebook.behaviors.filter(({ doc }) => doc.paradigm === 'fsm').length;
    const diagrams = page.split('stateDiagram-v2').length - 1;
    return diagrams >= fsm || 'an fsm behavior has no stateDiagram';
  },
};
