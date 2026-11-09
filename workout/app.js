'use strict';
/* ワークアウトログ PWA
   データは localStorage のみに保存（キー: workoutLogPwa.v1）。
   進行ルール: 全セット目標クリア & RPE<=7 で次回 +1回（秒数は +5秒）。RPE>=9 か未達で据え置き。
   メニュー: A/B/C が基本ローテーション（各2種類から交互に提示）。D（背中）とE（脚＋フットケア）は任意の日。 */

const STORE_KEY = 'workoutLogPwa.v1';

const MUSCLE_LABEL = { chest: '胸', arms: '腕・肩', core: '腹・体幹', back: '背中', legs: '脚', foot: '足・フットケア' };

const CATALOG = [
  { key: 'pushup-bar',        name: 'プッシュアップ（プッシュアップバー）', muscle: 'chest', equipment: 'プッシュアップバー', unit: 'reps', defSets: 3, defTarget: 10, art: 'push',      desc: 'バーを握って深く沈める。胸に効く基本種目' },
  { key: 'wide-pushup',       name: 'ワイドプッシュアップ',                 muscle: 'chest', equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'push',      desc: '手幅を広めに置く。胸の外側ねらい' },
  { key: 'tube-press',        name: 'チューブ・チェストプレス',             muscle: 'chest', equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'press',     desc: '背中にチューブを回し、前に押し出す' },
  { key: 'diamond-pushup',    name: 'ダイヤモンドプッシュアップ',           muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8,  art: 'push',      desc: '両手で菱形を作る。三頭ねらい' },
  { key: 'tube-kickback',     name: 'チューブ・キックバック',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'kickback',  desc: '前傾して肘を固定し、腕を後ろへ伸ばす' },
  { key: 'tube-curl',         name: 'チューブカール',                       muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'curl',      desc: 'チューブを踏んで肘を曲げる。二頭ねらい' },
  { key: 'tube-extension',    name: 'チューブ・オーバーヘッドエクステンション', muscle: 'arms', equipment: 'ゴムチューブ',     unit: 'reps', defSets: 3, defTarget: 12, art: 'extension', desc: '頭の後ろからチューブを上へ伸ばす' },
  { key: 'tube-shoulder-press', name: 'チューブ・ショルダープレス',         muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 10, art: 'pressup',   desc: 'チューブを踏んで頭上へ押し上げる' },
  { key: 'tube-side-raise',   name: 'チューブ・サイドレイズ',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'raise',     desc: '腕を真横に上げる。肩の中部ねらい' },
  { key: 'pike-pushup',       name: 'パイクプッシュアップ',                 muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8,  art: 'push',      desc: '腰を高く上げ、頭を床に近づける。肩ねらい' },
  { key: 'ab-roller',         name: '腹筋ローラー',                         muscle: 'core',  equipment: '腹筋ローラー',       unit: 'reps', defSets: 3, defTarget: 8,  art: 'roller',    desc: '膝つきで前に転がして戻す。腰を反らさない' },
  { key: 'dead-bug',          name: 'デッドバグ',                           muscle: 'core',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'bug',       desc: '仰向けで対角の手足をゆっくり下ろす' },
  { key: 'plank',             name: 'プランク',                             muscle: 'core',  equipment: '自重',               unit: 'sec',  defSets: 3, defTarget: 45, art: 'plank',     desc: '肘とつま先で体を一直線に保つ' },
  { key: 'bird-dog',          name: 'バードドッグ',                         muscle: 'core',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'bug',       desc: '四つん這いで対角の手足を伸ばす。体幹と背中' },
  { key: 'tube-row',          name: 'チューブ・ローイング',                 muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'row',       desc: '座って足裏にチューブをかけ、へそへ引く。肩甲骨を寄せる' },
  { key: 'tube-pull-apart',   name: 'チューブ・プルアパート',               muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'pullapart', desc: '胸の高さでチューブを両手に持ち、左右に開く' },
  { key: 'superman',          name: 'スーパーマン',                         muscle: 'back',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'superman',  desc: 'うつ伏せで手足を同時に浮かせて2秒キープ' },
  { key: 'tube-deadlift',     name: 'チューブ・デッドリフト',               muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 10, art: 'hinge',     desc: 'チューブを踏み、股関節を折って前傾→起こす。背中は丸めない' },
  { key: 'squat',             name: 'スクワット（自重）',                   muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 12, art: 'squat',     desc: '椅子に座るようにしゃがむ。膝はつま先の方向へ' },
  { key: 'split-squat',       name: 'スプリットスクワット',                 muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 2, defTarget: 8,  art: 'lunge',     desc: '前後に開いてまっすぐ上下。左右それぞれ行う' },
  { key: 'glute-bridge',      name: 'グルートブリッジ',                     muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 12, art: 'bridge',    desc: '仰向けで膝を立て、お尻を持ち上げて1秒キープ' },
  { key: 'calf-raise',        name: 'カーフレイズ',                         muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 15, art: 'calf',      desc: 'かかとをゆっくり上げ下げ。壁に手をついてOK' },
  { key: 'towel-gather',      name: 'タオルギャザー',                       muscle: 'foot',  equipment: 'タオル',             unit: 'reps', defSets: 2, defTarget: 10, art: 'towel',     desc: '椅子に座り、足指でタオルを手前にたぐり寄せる。左右それぞれ。足のつり対策' },
  { key: 'toe-gcp',           name: '足指グーチョキパー',                   muscle: 'foot',  equipment: '自重',               unit: 'reps', defSets: 2, defTarget: 10, art: 'toes',      desc: '足指でグー・チョキ・パーを繰り返す。左右それぞれ' },
  { key: 'ankle-roll',        name: '足首回し・足指ストレッチ',             muscle: 'foot',  equipment: '自重',               unit: 'sec',  defSets: 1, defTarget: 60, art: 'ankle',     desc: '足首を大きく回し、足指を広げたり握ったりする' },
];
const EX = Object.fromEntries(CATALOG.map(e => [e.key, e]));

/* ---------- 種目の小さなアニメーション（パターン別ピクトグラム） ---------- */
const FIG = {
  stand: '<circle cx="24" cy="8" r="3.4"/><line x1="24" y1="12" x2="24" y2="27"/><line x1="24" y1="27" x2="18" y2="41"/><line x1="24" y1="27" x2="30" y2="41"/>',
  floor: '<line x1="3" y1="43" x2="45" y2="43" class="fl"/>',
};
const ART = {
  push:      FIG.floor + '<g class="mv-bob"><line x1="9" y1="24" x2="33" y2="24"/><circle cx="37" cy="22" r="3.2"/><line x1="15" y1="24" x2="15" y2="38"/><line x1="9" y1="24" x2="4" y2="38"/></g>',
  plank:     FIG.floor + '<g class="mv-bob"><line x1="9" y1="26" x2="33" y2="26"/><circle cx="37" cy="24" r="3.2"/><line x1="13" y1="26" x2="13" y2="34"/><line x1="13" y1="34" x2="18" y2="34"/><line x1="9" y1="26" x2="4" y2="38"/></g>',
  press:     FIG.floor + FIG.stand + '<g class="mv-slide"><line x1="24" y1="17" x2="39" y2="17"/><line x1="39" y1="17" x2="39" y2="24" class="band"/></g>',
  pressup:   FIG.floor + FIG.stand + '<g class="mv-bobup"><line x1="24" y1="16" x2="15" y2="6"/><line x1="24" y1="16" x2="33" y2="6"/><line x1="15" y1="6" x2="33" y2="6" class="band"/></g>',
  curl:      FIG.floor + FIG.stand + '<line x1="24" y1="16" x2="24" y2="25"/><g class="mv-swing og-lt"><line x1="24" y1="25" x2="31" y2="32"/></g><line x1="24" y1="34" x2="31" y2="41" class="band"/>',
  raise:     FIG.floor + FIG.stand + '<g class="mv-swing-s og-c"><line x1="24" y1="16" x2="9" y2="21"/><line x1="24" y1="16" x2="39" y2="21"/></g>',
  kickback:  FIG.floor + '<line x1="13" y1="18" x2="29" y2="18"/><circle cx="33" cy="16" r="3.2"/><line x1="17" y1="18" x2="14" y2="41"/><line x1="24" y1="18" x2="27" y2="41"/><line x1="15" y1="18" x2="15" y2="27"/><g class="mv-swing-n og-lt"><line x1="15" y1="27" x2="6" y2="34"/></g>',
  extension: FIG.floor + FIG.stand + '<line x1="24" y1="16" x2="18" y2="9"/><g class="mv-swing-s og-lt"><line x1="18" y1="9" x2="24" y2="3"/></g><line x1="24" y1="3" x2="24" y2="14" class="band"/>',
  roller:    FIG.floor + '<line x1="15" y1="29" x2="29" y2="17"/><circle cx="33" cy="15" r="3.2"/><line x1="17" y1="29" x2="12" y2="41"/><line x1="17" y1="29" x2="22" y2="41"/><g class="mv-slide"><line x1="29" y1="17" x2="38" y2="33"/><circle cx="40" cy="37" r="4"/></g>',
  bug:       FIG.floor + '<line x1="12" y1="35" x2="31" y2="35"/><circle cx="8" cy="33" r="3.2"/><g class="mv-swing og-lt"><line x1="31" y1="35" x2="39" y2="27"/></g><g class="mv-swing-n og-rt"><line x1="12" y1="35" x2="5" y2="27"/></g>',
  row:       FIG.floor + '<line x1="6" y1="39" x2="27" y2="39"/><line x1="27" y1="39" x2="27" y2="19"/><circle cx="27" cy="14" r="3.4"/><g class="mv-slide"><line x1="27" y1="23" x2="13" y2="30"/><line x1="13" y1="30" x2="13" y2="39" class="band"/></g>',
  pullapart: FIG.floor + FIG.stand + '<g class="mv-spread og-c"><line x1="24" y1="17" x2="10" y2="15"/><line x1="24" y1="17" x2="38" y2="15"/><line x1="10" y1="15" x2="38" y2="15" class="band"/></g>',
  superman:  FIG.floor + '<g class="mv-lift og-c"><line x1="10" y1="33" x2="34" y2="33"/><circle cx="38" cy="31" r="3.2"/><line x1="34" y1="33" x2="43" y2="27"/><line x1="10" y1="33" x2="3" y2="27"/></g>',
  hinge:     FIG.floor + '<line x1="24" y1="28" x2="19" y2="42"/><line x1="24" y1="28" x2="29" y2="42"/><g class="mv-hinge og-lb"><line x1="24" y1="28" x2="24" y2="11"/><circle cx="24" cy="7" r="3.4"/><line x1="24" y1="17" x2="24" y2="30" class="band"/></g>',
  squat:     FIG.floor + '<g class="mv-squat"><circle cx="24" cy="7" r="3.4"/><line x1="24" y1="11" x2="24" y2="25"/><line x1="24" y1="15" x2="36" y2="17"/></g><line x1="24" y1="25" x2="16" y2="33"/><line x1="16" y1="33" x2="17" y2="42"/><line x1="24" y1="25" x2="32" y2="33"/><line x1="32" y1="33" x2="31" y2="42"/>',
  lunge:     FIG.floor + '<g class="mv-bob"><circle cx="24" cy="7" r="3.4"/><line x1="24" y1="11" x2="24" y2="25"/><line x1="24" y1="15" x2="15" y2="20"/><line x1="24" y1="15" x2="33" y2="20"/></g><line x1="24" y1="25" x2="14" y2="32"/><line x1="14" y1="32" x2="14" y2="42"/><line x1="24" y1="25" x2="34" y2="34"/><line x1="34" y1="34" x2="38" y2="42"/>',
  bridge:    FIG.floor + '<circle cx="7" cy="36" r="3.2"/><line x1="10" y1="38" x2="20" y2="38"/><g class="mv-bobup"><line x1="20" y1="38" x2="29" y2="29"/><line x1="29" y1="29" x2="29" y2="38"/></g>',
  calf:      FIG.floor + '<g class="mv-calf">' + FIG.stand + '</g>',
  towel:     FIG.floor + '<path d="M6 41 q4 -3 8 0 q4 3 8 0 q4 -3 8 0" class="band"/><g class="mv-slide"><path d="M30 38 l9 0 q3 0 3 3 l-13 0 q-2 -1 1 -3"/><line x1="33" y1="38" x2="32" y2="34"/><line x1="37" y1="38" x2="37" y2="34"/></g>',
  toes:      FIG.floor + '<path d="M14 41 q-2 -8 3 -12 l4 -3"/><g class="mv-spread og-lb"><line x1="21" y1="26" x2="17" y2="19"/><line x1="23" y1="25" x2="22" y2="17"/><line x1="25" y1="25" x2="27" y2="18"/></g>',
  ankle:     FIG.floor + '<line x1="24" y1="6" x2="24" y2="24"/><g class="mv-spin og-c"><line x1="24" y1="24" x2="24" y2="36"/><line x1="24" y1="36" x2="31" y2="38"/></g>',
};
function artSVG(pattern) {
  return `<svg class="art" viewBox="0 0 48 48" aria-hidden="true">${ART[pattern] || ART.push}</svg>`;
}

/* ---------- メニュー（セットメニューは複数から選べる） ---------- */
const MENUS = {
  A1: { group: 'A', label: 'A1（胸＋三頭・基本）',   items: ['pushup-bar', 'tube-press', 'diamond-pushup', 'tube-kickback'] },
  A2: { group: 'A', label: 'A2（胸＋三頭・変化球）', items: ['wide-pushup', 'pushup-bar', 'tube-extension', 'tube-kickback'] },
  B1: { group: 'B', label: 'B1（腕＋肩・基本）',     items: ['tube-curl', 'tube-extension', 'tube-shoulder-press', 'tube-side-raise'] },
  B2: { group: 'B', label: 'B2（腕＋肩・自重多め）', items: ['pike-pushup', 'tube-side-raise', 'tube-curl', 'tube-shoulder-press'] },
  C1: { group: 'C', label: 'C1（胸＋腹・基本）',     items: ['pushup-bar', 'ab-roller', 'dead-bug', 'plank'] },
  C2: { group: 'C', label: 'C2（胸＋腹・体幹寄り）', items: ['tube-press', 'ab-roller', 'bird-dog', 'dead-bug'] },
  D1: { group: 'D', label: 'D1（背中・基本）',       items: ['tube-row', 'superman', 'tube-pull-apart', 'bird-dog'] },
  D2: { group: 'D', label: 'D2（背中・ヒンジ入り）', items: ['tube-deadlift', 'tube-row', 'superman', 'plank'] },
  E1: { group: 'E', label: 'E1（脚＋フットケア）',   items: ['squat', 'calf-raise', 'towel-gather', 'toe-gcp'], note: '脚の日。レース週とレース前日は避ける' },
  E2: { group: 'E', label: 'E2（脚バランス＋足）',   items: ['split-squat', 'glute-bridge', 'calf-raise', 'ankle-roll'], note: '脚の日。レース週とレース前日は避ける' },
};
const MENU_ORDER = Object.keys(MENUS);
const ROTATION = ['A', 'B', 'C'];
const LEGACY_LABEL = { A: 'A（胸＋三頭）', B: 'B（腕＋肩）', C: 'C（胸＋腹）' };
function menuLabel(id) {
  if (id === 'free') return '自由';
  if (MENUS[id]) return MENUS[id].label;
  return LEGACY_LABEL[id] || id;
}
function groupOf(id) { return MENUS[id] ? MENUS[id].group : (LEGACY_LABEL[id] ? id : null); }

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
function nextMenu() {
  const last = sortedSessions().find(s => ROTATION.includes(groupOf(s.template)));
  const group = last ? ROTATION[(ROTATION.indexOf(groupOf(last.template)) + 1) % ROTATION.length] : 'A';
  const variants = MENU_ORDER.filter(id => MENUS[id].group === group);
  const done = state.sessions.filter(s => groupOf(s.template) === group).length;
  return variants[done % variants.length];
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
let currentMenu = null;
function renderHome() {
  if (!currentMenu || !MENUS[currentMenu]) currentMenu = nextMenu();
  const menu = MENUS[currentMenu];
  document.getElementById('week-count').textContent =
    `今週 ${weekCount()} / ${state.settings.weeklyTarget} 回`;
  document.getElementById('next-template').textContent = menu.label;
  document.getElementById('next-note').textContent = menu.note || '';
  const ul = document.getElementById('next-exercises');
  ul.innerHTML = '';
  menu.items.forEach(key => {
    const ex = EX[key];
    const nt = nextTargetFor(key);
    const li = document.createElement('li');
    li.innerHTML = `<span class="ex-art"></span><span class="ex-main"><span class="ex-name"></span><span class="ex-desc"></span></span><span class="target"></span>`;
    li.querySelector('.ex-art').innerHTML = artSVG(ex.art);
    li.querySelector('.ex-name').textContent = ex.name;
    li.querySelector('.ex-desc').textContent = ex.desc;
    li.querySelector('.target').textContent = `${nt.sets}セット × ${nt.target}${ex.unit === 'sec' ? '秒' : '回'}`;
    ul.appendChild(li);
  });
  const recent = document.getElementById('recent-list');
  const last3 = sortedSessions().slice(0, 3);
  recent.innerHTML = last3.length ? '' : '<p class="empty">まだ記録はありません</p>';
  last3.forEach(s => recent.appendChild(sessionItemEl(s, false)));
}
document.getElementById('btn-start').addEventListener('click', () => openEditor(currentMenu));
document.getElementById('btn-other-menu').addEventListener('click', () => {
  const group = MENUS[currentMenu].group;
  const variants = MENU_ORDER.filter(id => MENUS[id].group === group);
  if (variants.length > 1) {
    currentMenu = variants[(variants.indexOf(currentMenu) + 1) % variants.length];
  } else {
    const all = ['A', 'B', 'C', 'D', 'E'];
    const nextGroup = all[(all.indexOf(group) + 1) % all.length];
    currentMenu = MENU_ORDER.find(id => MENUS[id].group === nextGroup);
  }
  renderHome();
});
document.getElementById('btn-open-back').addEventListener('click', () => { currentMenu = 'D1'; openEditor('D1'); });
document.getElementById('btn-open-legs').addEventListener('click', () => { currentMenu = 'E1'; openEditor('E1'); });

/* ---------- 記録入力 ---------- */
let editorLogs = [];   // { key, target, sets: [..], effort, variation }
let editorLeg = null;

const templateSel = document.getElementById('f-template');
['A', 'B', 'C', 'D', 'E'].forEach(g => {
  const og = document.createElement('optgroup');
  og.label = { A: 'A 胸＋三頭', B: 'B 腕＋肩', C: 'C 胸＋腹', D: 'D 背中', E: 'E 脚＋フットケア' }[g];
  MENU_ORDER.filter(id => MENUS[id].group === g).forEach(id => {
    const o = document.createElement('option');
    o.value = id; o.textContent = MENUS[id].label;
    og.appendChild(o);
  });
  templateSel.appendChild(og);
});
const freeOpt = document.createElement('option');
freeOpt.value = 'free'; freeOpt.textContent = '自由';
templateSel.appendChild(freeOpt);

function openEditor(menuId) {
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-template').value = menuId;
  document.getElementById('f-runfeel').value = '';
  document.getElementById('f-note').value = '';
  editorLeg = null;
  document.querySelectorAll('#f-leg button').forEach(b => b.classList.remove('on'));
  buildEditorLogs(menuId);
  show('view-editor');
}
function buildEditorLogs(menuId) {
  editorLogs = [];
  const items = menuId === 'free' ? [] : MENUS[menuId].items;
  items.forEach(key => {
    const nt = nextTargetFor(key);
    editorLogs.push({ key, target: nt.target, sets: Array(nt.sets).fill(nt.target), effort: '', variation: '' });
  });
  renderEditorLogs();
}
templateSel.addEventListener('change', e => buildEditorLogs(e.target.value));

function renderEditorLogs() {
  const wrap = document.getElementById('editor-exercises');
  wrap.innerHTML = '';
  editorLogs.forEach((log, idx) => {
    const ex = EX[log.key];
    const div = document.createElement('div');
    div.className = 'ex-block';
    const unitLabel = ex.unit === 'sec' ? '秒' : '回';
    div.innerHTML = `
      <div class="ex-head"><span class="ex-art"></span><div><h3></h3>
      <div class="ex-meta">${MUSCLE_LABEL[ex.muscle]} ・ ${ex.equipment} ・ 目標 ${log.target}${unitLabel} × ${log.sets.length}セット</div>
      <div class="ex-desc"></div></div></div>
      <div class="sets"></div>
      <div class="ex-row">
        <label>RPE（きつさ 1〜10）<input type="number" min="1" max="10" step="1" inputmode="numeric" data-f="effort" placeholder="例：7"></label>
        <label>バリエーション<input type="text" data-f="variation" placeholder="例：膝つき"></label>
      </div>
      <button type="button" class="ex-remove">この種目を外す</button>`;
    div.querySelector('.ex-art').innerHTML = artSVG(ex.art);
    div.querySelector('h3').textContent = ex.name;
    div.querySelector('.ex-desc').textContent = ex.desc;
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
  o.value = ex.key; o.textContent = `${ex.name}（${MUSCLE_LABEL[ex.muscle]}）`;
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
  currentMenu = null; // 次回メニューを再計算
  show('view-history');
});

/* ---------- 履歴 ---------- */
function sessionItemEl(s, withDelete) {
  const div = document.createElement('div');
  div.className = 'session-item';
  const head = document.createElement('div');
  head.className = 'session-head';
  head.innerHTML = `<span class="date"></span><span></span>`;
  head.children[0].textContent = s.date;
  head.children[1].textContent = menuLabel(s.template);
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

/* ---------- 初期表示 ---------- */
renderHome();
