'use strict';
/* 論文骨子ドリル: 技術士二次試験（機械部門・機械設計）の過去問で論文骨子を回す。
記録は localStorage（gijutsushi:outlines）にだけ置く。JSON書き出し/読み込み対応。 */

const LS_KEY = 'gijutsushi:outlines';
const VIEWPOINTS = ['', '技術', '経済', '社会', '環境', '安全', '人材', '持続可能性', '制度', 'その他'];

let outlines = load();
let currentQid = null;
let editingId = null;
let mostImportant = 1;
let lastFocus = null;

let timerSetSec = 15 * 60;
let timerElapsed = 0;
let timerRunning = false;
let timerInt = null;

function load() {
try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]');} catch (e) { return [];}
}
function persist() { localStorage.setItem(LS_KEY, JSON.stringify(outlines));}
function qById(id) { return QUESTIONS.find(q => q.id === id);}
function subjectName(s) { return s === 'I'? '必須I': s;}
function qLabel(q) { return `令和${q.year}年度 ${subjectName(q.subject)} ${q.code.replace(/^(I|II-2|III)-/, m => m)}`;}
function esc(s) {
return String(s == null? '': s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}
function fmtAnswer(t) { return String(t || '').replace(/^#+\s*/gm, '');}
function countFor(qid) { return outlines.filter(o => o.qid === qid).length;}

/* ---------- 画面切り替え ---------- */
document.querySelectorAll('.tabbar button').forEach(b => {
b.addEventListener('click', () => showView(b.dataset.view));
});
function showView(id) {
document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
if (id === 'view-records') renderRecords();
window.scrollTo(0, 0);
}

/* ---------- 過去問バンク ---------- */
const bankList = document.getElementById('bank-list');
document.getElementById('f-subject').addEventListener('change', renderBank);
document.getElementById('f-year').addEventListener('change', renderBank);
document.getElementById('btn-random').addEventListener('click', () => {
const done = new Set(outlines.map(o => o.qid));
const pool = QUESTIONS.filter(q =>!done.has(q.id));
const pickFrom = pool.length? pool: QUESTIONS;
const q = pickFrom[Math.floor(Math.random() * pickFrom.length)];
startDrill(q.id);
});

function renderBank() {
const fs = document.getElementById('f-subject').value;
const fy = document.getElementById('f-year').value;
const list = QUESTIONS.filter(q => (!fs || q.subject === fs) && (!fy || String(q.year) === fy));
document.getElementById('bank-count').textContent = `${list.length}問`;
bankList.innerHTML = list.map(q => {
const n = countFor(q.id);
return `<div class="q-item">
<div class="q-head"><span class="q-title">${esc(qLabel(q))}</span>
${n? `<span class="badge">実施 ${n}回</span>`: '<span class="badge">未実施</span>'}</div>
<div class="q-actions">
<button type="button" data-act="drill" data-qid="${q.id}">骨子を作る</button>
<button type="button" data-act="q" data-qid="${q.id}">問題文</button>
<button type="button" data-act="a" data-qid="${q.id}">回答例</button>
</div>
<div class="qtext" data-box="q-${q.id}" hidden>${esc(q.text)}</div>
<div class="answer-box" data-box="a-${q.id}" hidden>${esc(fmtAnswer(ANSWERS[q.id]))}</div>
</div>`;
}).join('') || '<p class="empty">該当する問題がありません。</p>';
}
bankList.addEventListener('click', e => {
const b = e.target.closest('button[data-act]');
if (!b) return;
const qid = b.dataset.qid;
if (b.dataset.act === 'drill') startDrill(qid);
else {
const box = bankList.querySelector(`[data-box="${b.dataset.act}-${qid}"]`);
if (box) box.hidden =!box.hidden;
}
});
renderBank();

/* ---------- ドリル ---------- */
const drillForm = document.getElementById('drill-form');

function startDrill(qid, record) {
const q = qById(qid);
if (!q) return;
currentQid = qid;
editingId = record? record.id: null;
mostImportant = 1;
document.getElementById('drill-empty').hidden = true;
document.getElementById('drill-main').hidden = false;
document.getElementById('drill-title').textContent = qLabel(q) + (record? '（編集中）': '');
document.getElementById('drill-badge').textContent = q.subject === 'II-2'? '応用型': '課題解決型';
document.getElementById('drill-qtext').textContent = q.text;
document.getElementById('drill-answer').hidden = true;
buildForm(q);
if (record) fillForm(record.fields);
resetTimer();
renderChecks();
showView('view-drill');
}

function buildForm(q) {
if (q.subject === 'II-2') {
drillForm.innerHTML = `
<label class="field">調査・検討すべき事項
<textarea id="d-survey" placeholder="業務に着手する前に調べること、検討すること"></textarea>
</label>
<h3 class="form-h">業務の手順と留意点・工夫</h3>
<div id="d-steps"></div>
<button type="button" class="mini" id="btn-add-step">＋ 手順を追加</button>
<label class="field" style="margin-top:12px;">関係者との調整方策
<textarea id="d-coord" placeholder="誰と、何を、どう調整するか"></textarea>
</label>`;
addStep(); addStep(); addStep();
document.getElementById('btn-add-step').addEventListener('click', () => addStep());
} else {
const vpOpts = VIEWPOINTS.map(v => `<option value="${v}">${v || '観点を選ぶ'}</option>`).join('');
drillForm.innerHTML = `
<label class="field">想定する製品・対象
<textarea id="d-target" placeholder="例：産業用遠心ポンプ"></textarea>
</label>
${[1, 2, 3].map(i => `
<div class="issue-block">
<h3>課題${i}</h3>
<select id="d-vp-${i}" aria-label="観点${i}">${vpOpts}</select>
<textarea id="d-issue-${i}" placeholder="課題の内容"></textarea>
</div>`).join('')}
<div class="field">最も重要な課題
<div class="radio-row" id="d-most">
${[1, 2, 3].map(i => `<button type="button" data-v="${i}" class="${i === 1? 'on': ''}">課題${i}</button>`).join('')}
</div>
</div>
<label class="field">最重要と考える理由
<textarea id="d-reason"></textarea>
</label>
<h3 class="form-h">解決策（専門用語を織り込む）</h3>
<div id="d-solutions"></div>
<button type="button" class="mini" id="btn-add-sol">＋ 解決策を追加</button>
<label class="field" style="margin-top:12px;">残存リスク・波及効果と対策
<textarea id="d-risks" placeholder="解決策を実行しても残る／新たに生じるリスクと、その対策"></textarea>
</label>
${q.subject === 'I'? `
<label class="field">倫理・持続可能性の観点から必要な要件
<textarea id="d-ethics"></textarea>
</label>`: ''}`;
addSolution(); addSolution();
document.getElementById('btn-add-sol').addEventListener('click', () => addSolution());
document.getElementById('d-most').addEventListener('click', e => {
const b = e.target.closest('button[data-v]');
if (!b) return;
mostImportant = Number(b.dataset.v);
document.querySelectorAll('#d-most button').forEach(x => x.classList.toggle('on', x === b));
});
}
}

function addSolution(text) {
const wrap = document.getElementById('d-solutions');
const div = document.createElement('div');
div.className = 'row';
div.innerHTML = `<textarea class="sol-text" placeholder="解決策">${esc(text || '')}</textarea>
<button type="button" class="mini remove-line" style="flex:0 0 auto;">削除</button>`;
div.querySelector('textarea').style.minHeight = '60px';
div.querySelector('button').addEventListener('click', () => { div.remove(); renderChecks();});
wrap.appendChild(div);
}
function addStep(text, note) {
const wrap = document.getElementById('d-steps');
const n = wrap.children.length + 1;
const div = document.createElement('div');
div.className = 'step-block';
div.innerHTML = `<h3>手順${n}</h3>
<textarea class="step-text" placeholder="手順の内容">${esc(text || '')}</textarea>
<textarea class="step-note" placeholder="留意点・工夫" style="margin-top:6px;">${esc(note || '')}</textarea>
<button type="button" class="mini remove-line">この手順を削除</button>`;
div.querySelectorAll('textarea').forEach(t => { t.style.minHeight = '56px';});
div.querySelector('button').addEventListener('click', () => { div.remove(); renderChecks();});
wrap.appendChild(div);
}

function val(id) { const el = document.getElementById(id); return el? el.value.trim(): '';}

function collectFields() {
const q = qById(currentQid);
if (q.subject === 'II-2') {
return {
survey: val('d-survey'),
steps: Array.from(document.querySelectorAll('#d-steps.step-block')).map(b => ({
text: b.querySelector('.step-text').value.trim(),
note: b.querySelector('.step-note').value.trim(),
})),
coord: val('d-coord'),
};
}
const f = {
target: val('d-target'),
issues: [1, 2, 3].map(i => ({ vp: val(`d-vp-${i}`), text: val(`d-issue-${i}`)})),
most: mostImportant,
reason: val('d-reason'),
solutions: Array.from(document.querySelectorAll('#d-solutions.sol-text')).map(t => t.value.trim()).filter(Boolean),
risks: val('d-risks'),
};
if (q.subject === 'I') f.ethics = val('d-ethics');
return f;
}

function fillForm(f) {
const q = qById(currentQid);
if (q.subject === 'II-2') {
document.getElementById('d-survey').value = f.survey || '';
const wrap = document.getElementById('d-steps');
wrap.innerHTML = '';
(f.steps && f.steps.length? f.steps: [{}]).forEach(s => addStep(s.text, s.note));
document.getElementById('d-coord').value = f.coord || '';
return;
}
document.getElementById('d-target').value = f.target || '';
(f.issues || []).forEach((it, i) => {
document.getElementById(`d-vp-${i + 1}`).value = it.vp || '';
document.getElementById(`d-issue-${i + 1}`).value = it.text || '';
});
mostImportant = f.most || 1;
document.querySelectorAll('#d-most button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) === mostImportant));
document.getElementById('d-reason').value = f.reason || '';
const sw = document.getElementById('d-solutions');
sw.innerHTML = '';
(f.solutions && f.solutions.length? f.solutions: ['']).forEach(s => addSolution(s));
document.getElementById('d-risks').value = f.risks || '';
if (q.subject === 'I' && document.getElementById('d-ethics')) document.getElementById('d-ethics').value = f.ethics || '';
}

/* ---------- 自動チェック ---------- */
function runChecks(f) {
const q = qById(currentQid);
const checks = [];
if (q.subject === 'II-2') {
const stepsOk = f.steps.filter(s => s.text);
checks.push({ label: '全欄が埋まっている', ok:!!(f.survey && stepsOk.length && f.coord)});
checks.push({ label: '手順が3段階以上ある', ok: stepsOk.length >= 3});
checks.push({ label: '各手順に留意点・工夫がある', ok: stepsOk.length > 0 && f.steps.every(s =>!s.text || s.note)});
const all = [f.survey, f.coord,...f.steps.map(s => s.text + s.note)].join('');
checks.push({ label: '専門用語（キーワード）が含まれている', ok: KEYWORDS.some(k => k && all.includes(k))});
checks.push({ label: '調整方策が複数文で具体的に書かれている', ok: (f.coord.match(/。/g) || []).length >= 2});
return checks;
}
const vps = f.issues.map(i => i.vp).filter(Boolean);
let filled = f.target && f.reason && f.risks && f.issues.every(i => i.vp && i.text) && f.solutions.length > 0;
if (q.subject === 'I') filled = filled &&!!f.ethics;
checks.push({ label: '全欄が埋まっている', ok:!!filled});
checks.push({ label: '課題の観点が3つとも異なる', ok: vps.length === 3 && new Set(vps).size === 3});
checks.push({ label: '解決策が2つ以上ある', ok: f.solutions.length >= 2});
const solJoined = f.solutions.join('');
checks.push({ label: '解決策に専門用語（キーワード）が含まれている', ok: KEYWORDS.some(k => k && solJoined.includes(k))});
const tokens = solJoined.split(/[、,\s・／/（）()「」]+/).filter(t => t.length >= 3);
checks.push({ label: '残存リスクが解決策の裏返しになっている（解決策の語を含む）', ok: tokens.some(t => f.risks.includes(t))});
return checks;
}
function renderChecks() {
if (!currentQid) return;
const checks = runChecks(collectFields());
document.getElementById('check-list').innerHTML =
checks.map(c => `<li><span class="${c.ok? 'ok': 'ng'}">${c.ok? '○': '×'}</span> ${esc(c.label)}</li>`).join('') +
`<li class="hint">${checks.filter(c => c.ok).length}/${checks.length} クリア</li>`;
return checks;
}
drillForm.addEventListener('input', renderChecks);
drillForm.addEventListener('change', renderChecks);
drillForm.addEventListener('focusin', e => { if (e.target.tagName === 'TEXTAREA') lastFocus = e.target;});

/* ---------- キーワード ---------- */
const kwList = document.getElementById('kw-list');
function renderKeywords() {
const s = document.getElementById('kw-search').value.trim();
const list = KEYWORDS.filter(k =>!s || k.includes(s)).slice(0, 60);
kwList.innerHTML = list.map(k => `<button type="button" class="kw-chip">${esc(k)}</button>`).join('') ||
'<span class="hint">見つかりませんでした。</span>';
}
document.getElementById('kw-search').addEventListener('input', renderKeywords);
kwList.addEventListener('click', e => {
const chip = e.target.closest('.kw-chip');
if (!chip) return;
const t = lastFocus && document.contains(lastFocus)? lastFocus:
document.querySelector('#d-solutions.sol-text') || document.querySelector('#drill-form textarea');
if (!t) return;
const start = t.selectionStart || t.value.length;
t.value = t.value.slice(0, start) + chip.textContent + t.value.slice(t.selectionEnd || start);
t.focus();
renderChecks();
});
renderKeywords();

/* ---------- タイマー ---------- */
const timerDisplay = document.getElementById('timer-display');
function fmtTime(sec) {
const sign = sec < 0? '+': '';
const a = Math.abs(sec);
return sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
}
function drawTimer() {
const left = timerSetSec - timerElapsed;
timerDisplay.textContent = fmtTime(left);
timerDisplay.classList.toggle('over', left < 0);
}
function resetTimer() {
stopTimer();
timerSetSec = Math.max(1, Number(document.getElementById('timer-minutes').value) || 15) * 60;
timerElapsed = 0;
document.getElementById('timer-toggle').textContent = '開始';
drawTimer();
}
function stopTimer() {
timerRunning = false;
if (timerInt) { clearInterval(timerInt); timerInt = null;}
}
document.getElementById('timer-toggle').addEventListener('click', () => {
if (timerRunning) {
stopTimer();
document.getElementById('timer-toggle').textContent = '再開';
} else {
timerRunning = true;
document.getElementById('timer-toggle').textContent = '一時停止';
timerInt = setInterval(() => { timerElapsed++; drawTimer();}, 1000);
}
});
document.getElementById('timer-reset').addEventListener('click', resetTimer);
document.getElementById('timer-minutes').addEventListener('change', resetTimer);

/* ---------- 保存・コピー・回答例 ---------- */
document.getElementById('btn-save-outline').addEventListener('click', () => {
if (!currentQid) return;
const fields = collectFields();
const checks = runChecks(fields);
const rec = {
id: editingId || Date.now(),
qid: currentQid,
date: new Date().toISOString(),
minutes: Math.round(timerElapsed / 6) / 10,
fields, checks,
};
if (editingId) {
const i = outlines.findIndex(o => o.id === editingId);
if (i >= 0) outlines[i] = rec;
} else {
outlines.push(rec);
}
persist();
editingId = null;
renderBank();
showView('view-records');
});

function outlineToText(rec) {
const q = qById(rec.qid);
const f = rec.fields;
const lines = [`${qLabel(q)}`, `${rec.minutes}分`, ''];
if (q.subject === 'II-2') {
lines.push('■調査・検討すべき事項', f.survey || '', '', '■業務の手順と留意点・工夫');
(f.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s.text}`, ` 留意点: ${s.note}`));
lines.push('', '■関係者との調整方策', f.coord || '');
} else {
lines.push('■想定する製品・対象', f.target || '', '', '■課題');
(f.issues || []).forEach((it, i) => lines.push(`${i + 1}.（${it.vp || '観点なし'}）${it.text}`));
lines.push('', `■最も重要な課題: 課題${f.most || 1}`, '理由:', f.reason || '', '', '■解決策');
(f.solutions || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
lines.push('', '■残存リスク・波及効果と対策', f.risks || '');
if (q.subject === 'I') lines.push('', '■倫理・持続可能性の要件', f.ethics || '');
}
return lines.join('\n');
}
async function copyText(t) {
try { await navigator.clipboard.writeText(t); return true;}
catch (e) {
const ta = document.createElement('textarea');
ta.value = t; document.body.appendChild(ta); ta.select();
let ok = false;
try { ok = document.execCommand('copy');} catch (err) {}
ta.remove(); return ok;
}
}
document.getElementById('btn-copy-outline').addEventListener('click', async () => {
if (!currentQid) return;
const tmp = { qid: currentQid, minutes: Math.round(timerElapsed / 6) / 10, fields: collectFields()};
const ok = await copyText(outlineToText(tmp));
document.getElementById('btn-copy-outline').textContent = ok? 'コピーしました': 'コピーできませんでした';
setTimeout(() => { document.getElementById('btn-copy-outline').textContent = '添削用にコピー';}, 2000);
});
document.getElementById('btn-show-answer').addEventListener('click', () => {
const box = document.getElementById('drill-answer');
box.textContent = fmtAnswer(ANSWERS[currentQid]);
box.hidden =!box.hidden;
document.getElementById('btn-show-answer').textContent = box.hidden? '回答例を見る': '回答例を閉じる';
});

/* ---------- 記録 ---------- */
function renderRecords() {
const sum = document.getElementById('records-summary');
const by = { I: 0, 'II-2': 0, III: 0};
outlines.forEach(o => { const q = qById(o.qid); if (q) by[q.subject]++;});
sum.textContent = `合計 ${outlines.length}本（必須I ${by.I} / II-2 ${by['II-2']} / III ${by.III}）`;
const list = document.getElementById('records-list');
const sorted = [...outlines].sort((a, b) => b.id - a.id);
list.innerHTML = sorted.map(o => {
const q = qById(o.qid);
if (!q) return '';
const okN = (o.checks || []).filter(c => c.ok).length;
const d = new Date(o.date);
const ds = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
return `<div class="session-item">
<div class="session-head"><span class="date">${ds}</span><span>${esc(qLabel(q))}</span></div>
<div class="session-detail">所要 ${o.minutes}分 ／ チェック ${okN}/${(o.checks || []).length}</div>
<div class="q-actions">
<button type="button" data-ract="detail" data-id="${o.id}">詳細</button>
<button type="button" data-ract="edit" data-id="${o.id}">編集</button>
<button type="button" data-ract="copy" data-id="${o.id}">添削用にコピー</button>
<button type="button" data-ract="del" data-id="${o.id}">削除</button>
</div>
<div class="session-detail" data-rbox="${o.id}" hidden></div>
</div>`;
}).join('') || '<p class="empty">まだ記録がありません。</p>';
}
document.getElementById('records-list').addEventListener('click', async e => {
const b = e.target.closest('button[data-ract]');
if (!b) return;
const id = Number(b.dataset.id);
const rec = outlines.find(o => o.id === id);
if (!rec) return;
if (b.dataset.ract === 'del') {
if (!confirm('この骨子を削除しますか？')) return;
outlines = outlines.filter(o => o.id!== id);
persist(); renderRecords(); renderBank();
} else if (b.dataset.ract === 'edit') {
startDrill(rec.qid, rec);
} else if (b.dataset.ract === 'copy') {
const ok = await copyText(outlineToText(rec));
b.textContent = ok? 'コピーしました': 'コピーできませんでした';
setTimeout(() => { b.textContent = '添削用にコピー';}, 2000);
} else if (b.dataset.ract === 'detail') {
const box = document.querySelector(`[data-rbox="${id}"]`);
if (box.hidden) {
box.textContent = outlineToText(rec) + '\n\n===== 回答例 =====\n' + fmtAnswer(ANSWERS[rec.qid]);
box.hidden = false; b.textContent = '閉じる';
} else { box.hidden = true; b.textContent = '詳細';}
}
});

/* ---------- バックアップ ---------- */
document.getElementById('btn-export').addEventListener('click', () => {
const blob = new Blob([JSON.stringify({ app: 'gijutsushi-drill', version: 1, outlines}, null, 2)], { type: 'application/json'});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'gijutsushi-outlines.json';
a.click();
URL.revokeObjectURL(a.href);
});
document.getElementById('f-import').addEventListener('change', e => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
try {
const d = JSON.parse(reader.result);
const arr = Array.isArray(d)? d: d.outlines;
if (!Array.isArray(arr)) throw new Error('形式が違います');
outlines = arr;
persist(); renderRecords(); renderBank();
alert('読み込みました。');
} catch (err) { alert('読み込めませんでした: ' + err.message);}
};
reader.readAsText(file);
e.target.value = '';
});
document.getElementById('btn-wipe').addEventListener('click', () => {
if (!confirm('記録をすべて削除しますか？この操作は戻せません。')) return;
outlines = [];
persist(); renderRecords(); renderBank();
});
