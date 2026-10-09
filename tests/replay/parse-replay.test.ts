import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_RUN, BRANCH_RUN, fixtureText, parseText } from './replay-fixtures.ts';

function lines(text: string): string[] {
  return text.trimEnd().split('\n');
}

function withLine(text: string, index: number, edit: (line: Record<string, unknown>) => void): string {
  const all = lines(text);
  const line = JSON.parse(all[index] ?? '{}') as Record<string, unknown>;
  edit(line);
  all[index] = JSON.stringify(line);
  return `${all.join('\n')}\n`;
}

function tickObservation(line: Record<string, unknown>): Record<string, unknown> {
  return line.observation as Record<string, unknown>;
}

test('both fixtures load as header + 10 ticks + footer', async () => {
  for (const path of [BASE_RUN, BRANCH_RUN]) {
    const loaded = await parseText(await fixtureText(path));
    assert.deepEqual(loaded.issues, [], path);
    assert.equal(loaded.run?.header.mode, 'player');
    assert.equal(loaded.run?.ticks.length, 10);
    assert.equal(loaded.run?.footer.result, 'fail');
  }
});

test('CRLF line ends and a missing final newline are accepted', async () => {
  const text = await fixtureText(BASE_RUN);
  const loaded = await parseText(text.trimEnd().replaceAll('\n', '\r\n'));
  assert.deepEqual(loaded.issues, []);
});

test('a line that is not JSON or fails the schema is an issue on that line', async () => {
  const text = await fixtureText(BASE_RUN);
  const broken = lines(text);
  broken[2] = '{not json';
  const notJson = await parseText(broken.join('\n'));
  assert.equal(notJson.run, undefined);
  assert.equal(notJson.issues[0]?.line, 3);

  const badAction = await parseText(withLine(text, 3, (line) => (line.action = { wait: 0, attack: 2 })));
  assert.equal(badAction.run, undefined);
  assert.ok(badAction.issues.every((issue) => issue.line === 4));
  assert.ok(badAction.issues.length > 0);
});

test('header first, footer last and nothing else in between', async () => {
  const text = await fixtureText(BASE_RUN);
  const all = lines(text);
  const noHeader = await parseText(all.slice(1).join('\n'));
  assert.ok(noHeader.issues.some((issue) => issue.line === 1 && /first line must be the header/.test(issue.message)));
  const noFooter = await parseText(all.slice(0, -1).join('\n'));
  assert.ok(noFooter.issues.some((issue) => /last line must be the footer/.test(issue.message)));
  const twoHeaders = await parseText([all[0], ...all].join('\n'));
  assert.ok(twoHeaders.issues.some((issue) => issue.line === 2));
  assert.deepEqual((await parseText('')).issues.map((issue) => issue.message), ['empty replay file']);
});

test('ticks must increase and match their observation frame and the run mode', async () => {
  const text = await fixtureText(BASE_RUN);
  const repeated = withLine(text, 3, (line) => {
    line.tick = 1;
    tickObservation(line).tick = 1;
  });
  assert.ok((await parseText(repeated)).issues.some((issue) => issue.line === 4 && /does not follow/.test(issue.message)));

  const frameMismatch = withLine(text, 2, (line) => (line.tick = 99));
  assert.ok((await parseText(frameMismatch)).issues.some((issue) => /equal the observation tick/.test(issue.message)));

  const omniscientFrame = withLine(text, 2, (line) => (tickObservation(line).mode = 'omniscient'));
  assert.ok((await parseText(omniscientFrame)).issues.some((issue) => /differs from run mode player/.test(issue.message)));

  const twoChosen = withLine(text, 2, (line) => {
    for (const entry of line.decision as Record<string, unknown>[]) entry.chosen = true;
  });
  assert.ok((await parseText(twoChosen)).issues.some((issue) => /more than one candidate/.test(issue.message)));
});

test('a masked value in a player run is refused; the same value in an omniscient run loads', async () => {
  const text = await fixtureText(BASE_RUN);
  const masked = withLine(text, 4, (line) => {
    (tickObservation(line).self as Record<string, unknown>).hp = { value: 0.5, knowledge: 'masked' };
  });
  const refused = await parseText(masked);
  assert.equal(refused.run, undefined);
  assert.deepEqual(
    refused.issues.map((issue) => [issue.line, issue.pointer]),
    [[5, '/observation/self/hp']],
  );

  let omniscient = withLine(masked, 0, (line) => (line.mode = 'omniscient'));
  for (let index = 1; index <= 10; index += 1) omniscient = withLine(omniscient, index, (line) => (tickObservation(line).mode = 'omniscient'));
  const loaded = await parseText(omniscient);
  assert.deepEqual(loaded.issues, []);
  assert.equal(loaded.run?.header.mode, 'omniscient');
});

test('a masked value in the footer of a player run is refused', async () => {
  const text = await fixtureText(BASE_RUN);
  const masked = withLine(text, 11, (line) => (line.summary = { drop: { value: 0.1, knowledge: 'masked' } }));
  assert.deepEqual(
    (await parseText(masked)).issues.map((issue) => [issue.line, issue.pointer]),
    [[12, '/summary/drop']],
  );
});
