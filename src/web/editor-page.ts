// The editor page (stage 7): one self-contained HTML document, no external scripts. Lists the
// bundle's documents, edits any of them as JSON (entities, tactics, intents, rules, states,
// stages), edits map annotations as a table, lists consolidate proposals with approve / apply,
// and lists divergences with accept / reject. Every save shows the schema result and the
// bundle's validation; nothing is kept in the page: reload shows the files as they are.

export const EDITOR_PAGE = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>攻略本エディタ</title>
<style>
:root { --bg: #fbfaf7; --fg: #1f2328; --muted: #656d76; --line: #d0d7de; --accent: #0b6bcb; --bad: #b42318; --ok: #1a7f37; --panel: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --bg: #15181d; --fg: #e6edf3; --muted: #9da7b3; --line: #30363d; --accent: #4ea1ff; --bad: #ff7b72; --ok: #56d364; --panel: #1c2128; } }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: var(--bg); color: var(--fg); }
header { padding: 10px 16px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
header h1 { font-size: 16px; margin: 0; }
main { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; min-height: calc(100vh - 48px); }
@media (max-width: 720px) { main { grid-template-columns: 1fr; } }
nav { border-right: 1px solid var(--line); padding: 8px 12px; overflow: auto; }
nav h2 { font-size: 12px; color: var(--muted); margin: 12px 0 4px; text-transform: uppercase; }
nav button.file { display: block; width: 100%; text-align: left; background: none; border: 0; color: var(--fg); padding: 2px 4px; border-radius: 4px; cursor: pointer; word-break: break-all; }
nav button.file.active { background: var(--accent); color: #fff; }
section { padding: 12px 16px; overflow: auto; }
.tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.tabs button, .act { border: 1px solid var(--line); background: var(--panel); color: var(--fg); padding: 4px 10px; border-radius: 6px; cursor: pointer; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
textarea { width: 100%; min-height: 420px; font: 12px/1.45 ui-monospace, monospace; background: var(--panel); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 8px; }
input { background: var(--panel); color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 3px 6px; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid var(--line); padding: 4px 6px; text-align: left; vertical-align: top; }
.bad { color: var(--bad); } .ok { color: var(--ok); } .muted { color: var(--muted); }
pre { white-space: pre-wrap; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; font-size: 12px; }
</style>
</head>
<body>
<header><h1>攻略本エディタ</h1><span id="game" class="muted"></span><span id="status" class="muted"></span></header>
<main>
<nav id="files"></nav>
<section>
<div class="tabs">
<button data-tab="doc" class="active">文書</button><button data-tab="map">地図注記</button><button data-tab="proposals">観測差分の採否</button><button data-tab="divergences">ズレ判定</button>
</div>
<div id="tab-doc"><div class="muted" id="doc-path">左の一覧から文書を選ぶ</div><textarea id="doc" spellcheck="false"></textarea><p><button class="act" id="save">保存 (スキーマ検査 → 書き込み → validate)</button></p></div>
<div id="tab-map" hidden><p class="muted">地図 (stages/&lt;slug&gt;/map.json) を選ぶと注記を表で編集できる。</p><table id="annotations"></table><p><button class="act" id="add-note">注記を足す</button> <button class="act" id="save-map">地図を保存</button></p></div>
<div id="tab-proposals" hidden><p>判定者 <input id="approver" placeholder="名前"> 根拠 <input id="reason" size="40" placeholder="承認の理由"></p><div id="proposals"></div><p><button class="act" id="apply">承認済みと自動反映可を正本へ反映 (consolidate --apply)</button></p></div>
<div id="tab-divergences" hidden><p>判定者 <input id="judge" placeholder="名前"> メモ <input id="note" size="40"></p><div id="divergences"></div></div>
<h3>結果</h3><pre id="result">-</pre>
</section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let current = null;
let currentDoc = null;
const api = async (method, path, body) => {
  const response = await fetch(path, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
};
const show = (value) => { $('result').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
const showValidation = (validation) => {
  if (!validation) return;
  $('status').innerHTML = validation.ok ? '<span class="ok">validate: ok</span>' : '<span class="bad">validate: エラー ' + validation.findings.filter((f) => f.severity === 'error').length + ' 件</span>';
};
function tab(name) {
  for (const button of document.querySelectorAll('.tabs button')) button.classList.toggle('active', button.dataset.tab === name);
  for (const id of ['doc', 'map', 'proposals', 'divergences']) $('tab-' + id).hidden = id !== name;
  if (name === 'proposals') loadProposals();
  if (name === 'divergences') loadDivergences();
}
for (const button of document.querySelectorAll('.tabs button')) button.onclick = () => tab(button.dataset.tab);
async function loadBundle() {
  const { data } = await api('GET', '/api/bundle');
  $('game').textContent = (data.game_id || '?') + ' ' + (data.version || '');
  showValidation(data.validation);
  const groups = {};
  for (const path of data.files) (groups[path.split('/')[0]] ||= []).push(path);
  $('files').innerHTML = '';
  for (const [group, paths] of Object.entries(groups)) {
    const heading = document.createElement('h2'); heading.textContent = group; $('files').append(heading);
    for (const path of paths) {
      const button = document.createElement('button'); button.className = 'file'; button.textContent = path; button.onclick = () => openDoc(path); $('files').append(button);
    }
  }
}
async function openDoc(path) {
  const { status, data } = await api('GET', '/api/doc?path=' + encodeURIComponent(path));
  if (status !== 200) return show(data);
  current = path; currentDoc = data.doc;
  for (const button of document.querySelectorAll('nav button.file')) button.classList.toggle('active', button.textContent === path);
  $('doc-path').textContent = path + ' (' + data.schema + ')';
  $('doc').value = JSON.stringify(data.doc, null, 2);
  renderAnnotations();
}
async function saveDoc(doc) {
  const { data } = await api('PUT', '/api/doc?path=' + encodeURIComponent(current), { doc });
  show(data); showValidation(data.validation);
  if (data.saved) { currentDoc = doc; $('doc').value = JSON.stringify(doc, null, 2); renderAnnotations(); }
}
$('save').onclick = () => { if (!current) return; try { saveDoc(JSON.parse($('doc').value)); } catch (error) { show('JSON として読めない: ' + error.message); } };
function renderAnnotations() {
  const table = $('annotations');
  if (!current || !current.endsWith('/map.json') || !currentDoc) { table.innerHTML = '<tr><td class="muted">地図が選ばれていない</td></tr>'; return; }
  table.innerHTML = '<tr><th>対象ノード</th><th>種類</th><th>参照</th><th>メモ (ja)</th><th>境界</th><th></th></tr>';
  currentDoc.annotations.forEach((note, index) => {
    const row = table.insertRow();
    for (const [key, value] of [['target', note.target], ['kind', note.kind], ['ref', note.ref || ''], ['note', (note.note && note.note.ja) || ''], ['knowledge', note.knowledge]]) {
      const input = document.createElement('input'); input.value = value; input.dataset.key = key; input.dataset.index = index; row.insertCell().append(input);
    }
    const remove = document.createElement('button'); remove.className = 'act'; remove.textContent = '削除'; remove.onclick = () => { currentDoc.annotations.splice(index, 1); renderAnnotations(); }; row.insertCell().append(remove);
  });
}
function collectAnnotations() {
  const notes = currentDoc.annotations.map((note) => ({ ...note }));
  for (const input of document.querySelectorAll('#annotations input')) {
    const note = notes[Number(input.dataset.index)]; const key = input.dataset.key; const value = input.value.trim();
    if (key === 'note') { if (value) note.note = { ...(note.note || {}), ja: value }; else delete note.note; }
    else if (key === 'ref') { if (value) note.ref = value; else delete note.ref; }
    else note[key] = value;
  }
  return notes;
}
$('add-note').onclick = () => { if (!currentDoc || !currentDoc.annotations) return; currentDoc.annotations = collectAnnotations(); currentDoc.annotations.push({ target: currentDoc.nodes[0] ? currentDoc.nodes[0].id : '', kind: 'hazard', knowledge: 'masked' }); renderAnnotations(); };
$('save-map').onclick = () => { if (!currentDoc || !currentDoc.annotations) return; saveDoc({ ...currentDoc, annotations: collectAnnotations() }); };
async function loadProposals() {
  const { data } = await api('GET', '/api/proposals');
  const proposals = (data.result && data.result.proposals) || [];
  if (!data.ok) { $('proposals').innerHTML = '<p class="muted">提案なし (' + (data.stderr || '').trim() + ')</p>'; return; }
  const approved = new Set(data.result.approved || []); const stale = new Map((data.result.stale || []).map((entry) => [entry.proposal, entry.why]));
  $('proposals').innerHTML = '';
  const table = document.createElement('table'); table.innerHTML = '<tr><th>提案</th><th>状態</th><th>理由</th><th>根拠 run</th><th></th></tr>';
  for (const proposal of proposals) {
    const row = table.insertRow();
    const state = proposal.status === 'auto' ? '自動反映可' : approved.has(proposal.id) ? '承認済み' : stale.has(proposal.id) ? '承認失効: ' + stale.get(proposal.id) : '承認待ち';
    for (const value of [proposal.id, state, proposal.reason, proposal.evidence.join(', ')]) row.insertCell().textContent = value;
    const cell = row.insertCell();
    if (proposal.status !== 'auto') { const button = document.createElement('button'); button.className = 'act'; button.textContent = '承認'; button.onclick = () => approve(proposal.id); cell.append(button); }
  }
  $('proposals').append(table);
}
async function approve(id) {
  const { data } = await api('POST', '/api/proposals/approve', { proposal: id, by: $('approver').value, reason: $('reason').value });
  show(data); loadProposals();
}
$('apply').onclick = async () => { const { data } = await api('POST', '/api/proposals/apply', {}); show(data); loadBundle(); loadProposals(); };
async function loadDivergences() {
  const { data } = await api('GET', '/api/divergences');
  $('divergences').innerHTML = '';
  const table = document.createElement('table'); table.innerHTML = '<tr><th>ID</th><th>種類</th><th>内容</th><th>判定</th><th></th></tr>';
  for (const entry of data.divergences || []) {
    const row = table.insertRow();
    for (const value of [entry.id, entry.kind, entry.summary, entry.decision + (entry.decided_by ? ' (' + entry.decided_by + ')' : '')]) row.insertCell().textContent = value;
    const cell = row.insertCell();
    for (const [verb, label] of [['accept', '許容'], ['reject', '却下']]) { const button = document.createElement('button'); button.className = 'act'; button.textContent = label; button.onclick = () => judge(verb, entry.id); cell.append(button); }
  }
  $('divergences').append(table);
}
async function judge(verb, id) {
  const { data } = await api('POST', '/api/divergences/' + verb, { id, by: $('judge').value, note: $('note').value });
  show(data); loadDivergences();
}
loadBundle();
</script>
</body>
</html>
`;
