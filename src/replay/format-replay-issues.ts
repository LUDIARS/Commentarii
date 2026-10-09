// Human text for a replay file that failed to load.

import type { ReplayIssue } from './parse-replay.ts';

export function formatReplayIssues(path: string, issues: readonly ReplayIssue[]): string {
  const lines = issues.map((issue) => `${path}:${issue.line} ${issue.pointer === '' ? '/' : issue.pointer} ${issue.message}`);
  return `${lines.join('\n')}\n${path}: ${issues.length} issue(s); not a usable replay\n`;
}
