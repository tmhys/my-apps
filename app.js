'use strict';
/* ワークアウトログ PWA
   データは localStorage のみに保存（キー: workoutLogPwa.v1）。
   進行ルール: 全セット目標クリア & RPE<=7 で次回 +1回（秒数は +5秒）。RPE>=9 か未達で据え置き。 */

const STORE_KEY = 'workoutLogPwa.v1';

const CATALOG = [
  { key: 'pushup-bar',        name: 'プッシュアップ（プッシュアップバー）', muscle: 'chest', equipment: 'プッシュアップバー', unit: 'reps', defSets: 3, defTarget: 10 },
  { key: 'wide-pushup',       name: 'ワイドプッシュアップ',                 muscle: 'chest', equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10 },
  { key: 'tube-press',        name: 'チューブ・チェストプレス',             muscle: 'chest', equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12 },
  { key: 'diamond-pushup',    name: 'ダイヤモンドプッシュアップ',           muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8 },
  { key: 'tube-kickback',     name: 'チューブ・キックバック',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12 },
  { key: 'tube-curl',         name: 'チューブカール',                       muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12 },
  { key: 'tube-extension',    name: 'チューブ・オーバーヘッドエクステンション', muscle: 'arms', equipment: 'ゴムチューブ',     unit: 'reps', defSets: 3, defTarget: 12 },
  { key: 'tube-shoulder-press', name: 'チューブ・ショルダープレス',         muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 10 },
  { key: 'tube-side-raise',   name: 'チューブ・サイドレイズ',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12 },
  { key: 'pike-pushup',       name: 'パイクプッシュアップ',                 muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8 },
  { key: 'ab-roller',         name: '腹筋ローラー',                         muscle: 'core',  equipment: '腹筋ローラー',       unit: 'reps', defSets: 3, defTarget: 8 },
  { key: 'dead-bug',          name: 'デッドバグ',                           muscle: 'core',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10 },
  { key: 'plank',             name: 'プランク',                             muscle: 'core',  equipment: '自重',               unit: 'sec',  defSets: 3, defTarget: 45 },
];
const EX = Object.fromEntries(CATALOG.map(e => [e.key, e]));

const TEMPLATES = {
  A: { label: 'A（胸＋三頭）', items: ['pushup-bar', 'wide-pushup', 'diamond-pushup', 'tube-kickback'] },
  B: { label: 'B（腕＋肩）',   items: ['tube-curl', 'tube-extension', 'tube-shoulder-press', 'tube-side-raise'] },
  C: { label: 'C（胸＋腹）',   items: ['pushup-bar', 'ab-roller', 'dead-bug', 'plank'] },
};
const ROTATION = ['A', 'B', 'C'];

function defaultState() {
  return { settings: { weeklyTarget: 3, targetMinutes: 30 }, sessions: [] };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.sessions) || !s.settings) return defaultState();
    return s;
  } catch { return defaultState(); }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
let state = load();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function sortedSessions() {
  return [...state.sessions].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
}
function lastLogFor(key) {
  for (const s of sortedSessions()) {
    const log = (s.logs || []).find(l => l.key === key);
    if (log) return { session: s, log };
  }
  return null;
}
/* 次回の目標: { sets: セット数, target: 1セットの目標 } */
function nextTargetFor(key) {
  const ex = EX[key];
  const found = lastLogFor(key);
  if (!found || typeof found.log.target !== 'number') {
    return { sets: ex.defSets, target: ex.defTarget };
  }
  const { log } = found;
  const setsCount = log.sets.length || ex.defSets;
  const cleared = log.sets.length > 0 && log.sets.every(v => v >= log.target);
  const easy = typeof log.effort === 'number' && log.effort <= 7;
  let target = log.target;
  if (cleared && easy) target += ex.unit === 'sec' ? 5 : 1;
  return { sets: setsCount, target };
}
function nextTemplate() {
  const last = sortedSessions().find(s => ROTATION.includes(s.template));
  if (!last) return 'A';
  return ROTATION[(ROTATION.indexOf(last.template) + 1) % ROTATION.length];
}
function weekCount() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 月曜=0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lo = fmt(monday), hi = fmt(sunday);
  return state.sessions.filter(s => s.date >= lo && s.date <= hi).length;
}
function fmtSets(log) {
  const unit = EX[log.key] && EX[log.key].unit === 'sec' ? '秒' : '回';
  return log.sets.join(' / ') + unit;
}

/* ---------- 画面遷移 ---------- */
const views = ['view-home', 'view-editor', 'view-history', 'view-progress', 'view-settings'];
function show(viewId) {
  views.forEach(v => document.getElementById(v).classList.toggle('active', v === viewId));
  document.querySelectorAll('.tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === viewId));
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-history') renderHistory();
  if (viewId === 'view-progress') renderProgress();
  if (viewId === 'view-settings') renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.view)));

/* ---------- ホーム ---------- */
function renderHome() {
  const t = nextTemplate();
  document.getElementById('week-count').textContent =
    `今週 ${weekCount()} / ${state.settings.weeklyTarget} 回`;
  document.getElementById('next-template').textContent = TEMPLATES[t].label;
  const ul = document.getElementById('next-exercises');
  ul.innerHTML = '';
  TEMPLATES[t].items.forEach(key => {
    const ex = EX[key];
    const nt = nextTargetFor(key);
    const li = document.createElement('li');
    li.innerHTML = `<span></span><span class="target"></span>`;
    li.children[0].textContent = ex.name;
    li.children[1].textContent = `${nt.sets}セット × ${nt.target}${ex.unit === 'sec' ? '秒' : '回'}`;
    ul.appendChild(li);
  });
  const recent = document.getElementById('recent-list');
  const last3 = sortedSessions().slice(0, 3);
  recent.innerHTML = last3.length ? '' : '<p class="empty">まだ記録はありません</p>';
  last3.forEach(s => recent.appendChild(sessionItemEl(s, false)));
}
document.getElementById('btn-start').addEventListener('click', () => openEditor(nextTemplate()));

/* ---------- 記録入力 ---------- */
let editorLogs = [];   // { key, target, sets: [..], effort, variation }
let editorLeg = null;

function openEditor(template) {
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-template').value = template;
  document.getElementById('f-runfeel').value = '';
  document.getElementById('f-note').value = '';
  editorLeg = null;
  document.querySelectorAll('#f-leg button').forEach(b => b.classList.remove('on'));
  buildEditorLogs(template);
  show('view-editor');
}
function buildEditorLogs(template) {
  editorLogs = [];
  const items = template === 'free' ? [] : TEMPLATES[template].items;
  items.forEach(key => {
    const nt = nextTargetFor(key);
    editorLogs.push({ key, target: nt.target, sets: Array(nt.sets).fill(nt.target), effort: '', variation: '' });
  });
  renderEditorLogs();
}
document.getElementById('f-template').addEventListener('change', e => buildEditorLogs(e.target.value));

function renderEditorLogs() {
  const wrap = document.getElementById('editor-exercises');
  wrap.innerHTML = '';
  editorLogs.forEach((log, idx) => {
    const ex = EX[log.key];
    const div = document.createElement('div');
    div.className = 'ex-block';
    const unitLabel = ex.unit === 'sec' ? '秒' : '回';
    div.innerHTML = `
      <h3></h3>
      <div class="ex-meta">${ex.equipment} ・ 目標 ${log.target}${unitLabel} × ${log.sets.length}セット</div>
      <div class="sets"></div>
      <div class="ex-row">
        <label>RPE（きつさ 1〜10）<input type="number" min="1" max="10" step="1" inputmode="numeric" data-f="effort" placeholder="例：7"></label>
        <label>バリエーション<input type="text" data-f="variation" placeholder="例：膝つき"></label>
      </div>
      <button type="button" class="ex-remove">この種目を外す</button>`;
    div.querySelector('h3').textContent = ex.name;
    const setsWrap = div.querySelector('.sets');
    log.sets.forEach((v, si) => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.max = '999'; inp.inputMode = 'numeric';
      inp.value = v;
      inp.addEventListener('input', () => { log.sets[si] = parseInt(inp.value, 10) || 0; });
      setsWrap.appendChild(inp);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'mini'; addBtn.textContent = '＋セット';
    addBtn.addEventListener('click', () => { log.sets.push(log.target); renderEditorLogs(); });
    setsWrap.appendChild(addBtn);
    if (log.sets.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'mini'; delBtn.textContent = '−セット';
      delBtn.addEventListener('click', () => { log.sets.pop(); renderEditorLogs(); });
      setsWrap.appendChild(delBtn);
    }
    div.querySelector('[data-f="effort"]').addEventListener('input', e => { log.effort = e.target.value; });
    div.querySelector('[data-f="variation"]').addEventListener('input', e => { log.variation = e.target.value; });
    div.querySelector('.ex-remove').addEventListener('click', () => { editorLogs.splice(idx, 1); renderEditorLogs(); });
    wrap.appendChild(div);
  });
}
const addSel = document.getElementById('f-add-exercise');
CATALOG.forEach(ex => {
  const o = document.createElement('option');
  o.value = ex.key; o.textContent = ex.name;
  addSel.appendChild(o);
});
document.getElementById('btn-add-exercise').addEventListener('click', () => {
  const key = addSel.value;
  if (editorLogs.some(l => l.key === key)) return;
  const nt = nextTargetFor(key);
  editorLogs.push({ key, target: nt.target, sets: Array(nt.sets).fill(nt.target), effort: '', variation: '' });
  renderEditorLogs();
});
document.querySelectorAll('#f-leg button').forEach(b =>
  b.addEventListener('click', () => {
    editorLeg = editorLeg === Number(b.dataset.v) ? null : Number(b.dataset.v);
    document.querySelectorAll('#f-leg button').forEach(x =>
      x.classList.toggle('on', Number(x.dataset.v) === editorLeg));
  }));
document.getElementById('btn-cancel').addEventListener('click', () => show('view-home'));
document.getElementById('btn-save').addEventListener('click', () => {
  const date = document.getElementById('f-date').value;
  if (!date) { alert('日付を選んでください'); return; }
  if (!editorLogs.length) { alert('種目がありません'); return; }
  const logs = editorLogs.map(l => {
    const ex = EX[l.key];
    const effort = parseInt(l.effort, 10);
    return {
      key: l.key, name: ex.name, muscle: ex.muscle, equipment: ex.equipment,
      target: l.target,
      sets: l.sets.map(v => Math.max(0, parseInt(v, 10) || 0)),
      variation: (l.variation || '').trim(),
      effort: Number.isFinite(effort) && effort >= 1 && effort <= 10 ? effort : null,
    };
  });
  state.sessions.push({
    id: uid(),
    date,
    template: document.getElementById('f-template').value,
    legFatigue: editorLeg,
    runFeel: document.getElementById('f-runfeel').value.trim(),
    note: document.getElementById('f-note').value.trim(),
    logs,
  });
  save();
  show('view-history');
});

/* ---------- 履歴 ---------- */
function sessionItemEl(s, withDelete) {
  const div = document.createElement('div');
  div.className = 'session-item';
  const tLabel = s.template === 'free' ? '自由' : (TEMPLATES[s.template] ? TEMPLATES[s.template].label : s.template);
  const head = document.createElement('div');
  head.className = 'session-head';
  head.innerHTML = `<span class="date"></span><span></span>`;
  head.children[0].textContent = s.date;
  head.children[1].textContent = tLabel;
  div.appendChild(head);
  const detail = document.createElement('div');
  detail.className = 'session-detail';
  const lines = (s.logs || []).map(l =>
    `${l.name}：${fmtSets(l)}${typeof l.target === 'number' ? `（目標 ${l.target}）` : ''}${l.effort ? ` RPE${l.effort}` : ''}${l.variation ? ` / ${l.variation}` : ''}`);
  if (s.legFatigue) lines.push(`脚の疲労感：${s.legFatigue} / 5`);
  if (s.runFeel) lines.push(`ラン感覚：${s.runFeel}`);
  if (s.note) lines.push(`メモ：${s.note}`);
  detail.textContent = lines.join('\n');
  detail.style.whiteSpace = 'pre-line';
  div.appendChild(detail);
  if (withDelete) {
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = 'この記録を削除';
    del.addEventListener('click', () => {
      if (!confirm(`${s.date} の記録を削除しますか？`)) return;
      state.sessions = state.sessions.filter(x => x.id !== s.id);
      save(); renderHistory(); renderHome();
    });
    detail.appendChild(document.createElement('br'));
    detail.appendChild(del);
  }
  return div;
}
function renderHistory() {
  const wrap = document.getElementById('history-list');
  const list = sortedSessions();
  wrap.innerHTML = list.length ? '' : '<p class="empty">まだ記録はありません</p>';
  list.forEach(s => wrap.appendChild(sessionItemEl(s, true)));
}

/* ---------- 進捗 ---------- */
function renderProgress() {
  const wrap = document.getElementById('progress-list');
  wrap.innerHTML = '';
  let any = false;
  CATALOG.forEach(ex => {
    const found = lastLogFor(ex.key);
    if (!found) return;
    any = true;
    const nt = nextTargetFor(ex.key);
    const div = document.createElement('div');
    div.className = 'session-item';
    div.innerHTML = `<div class="session-head"><span class="date"></span><span class="target"></span></div>
      <div class="session-detail"></div>`;
    div.querySelector('.date').textContent = ex.name;
    div.querySelector('.target').textContent = `次回 ${nt.sets}セット × ${nt.target}${ex.unit === 'sec' ? '秒' : '回'}`;
    div.querySelector('.session-detail').textContent =
      `前回（${found.session.date}）：${fmtSets(found.log)}${found.log.effort ? ` RPE${found.log.effort}` : ''}`;
    wrap.appendChild(div);
  });
  if (!any) wrap.innerHTML = '<p class="empty">記録が貯まるとここに表示されます</p>';
}

/* ---------- 設定・データ ---------- */
function renderSettings() {
  document.getElementById('s-weekly').value = state.settings.weeklyTarget;
  document.getElementById('s-minutes').value = state.settings.targetMinutes;
}
document.getElementById('btn-save-settings').addEventListener('click', () => {
  const w = parseInt(document.getElementById('s-weekly').value, 10);
  const m = parseInt(document.getElementById('s-minutes').value, 10);
  if (Number.isFinite(w) && w >= 1 && w <= 14) state.settings.weeklyTarget = w;
  if (Number.isFinite(m) && m >= 5 && m <= 180) state.settings.targetMinutes = m;
  save();
  alert('設定を保存しました');
});
document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-log-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('f-import').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.sessions) || !data.settings) throw new Error('bad format');
      if (!confirm('現在のデータを、読み込んだファイルの内容で置き換えますか？')) return;
      state = data;
      save();
      alert('読み込みました');
      show('view-home');
    } catch {
      alert('読み込めませんでした。ワークアウトログの書き出しファイルを選んでください。');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
document.getElementById('btn-wipe').addEventListener('click', () => {
  if (!confirm('全データを削除しますか？この操作は戻せません。')) return;
  if (!confirm('本当に削除しますか？先にJSONで書き出しておくのがおすすめです。')) return;
  state = defaultState();
  save();
  show('view-home');
});

/* ---------- 初期表示 & Service Worker ---------- */
renderHome();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
