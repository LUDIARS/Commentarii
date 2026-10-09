// C-6 buildKnowledgeReport(load): row totals add up and ratios stay within 0..1.

import type { KnowledgeReport } from '../report/knowledge-report.ts';

export default {
  post: (report: KnowledgeReport) => {
    let shown = 0;
    let discoverable = 0;
    let masked = 0;
    for (const row of [...report.entities, report.totals]) {
      if (row.total !== row.shown + row.discoverable + row.masked) return `${'id' in row ? row.id : 'totals'}: total does not add up`;
      for (const ratio of Object.values(row.ratio)) if (ratio < 0 || ratio > 1) return 'ratio out of range';
    }
    for (const row of report.entities) {
      shown += row.shown;
      discoverable += row.discoverable;
      masked += row.masked;
    }
    const { totals } = report;
    return (totals.shown === shown && totals.discoverable === discoverable && totals.masked === masked) || 'totals differ from the sum of rows';
  },
};
