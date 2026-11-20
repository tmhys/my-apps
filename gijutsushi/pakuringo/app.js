'use strict';
/* キーワード学習（パクリンゴ）: 技術士二次試験のキーワード55語をレッスン形式で回す。
   進捗は localStorage（pakuringo:state）にだけ置く。初回だけスペース版の進捗を引き継ぐ。 */

const LS_KEY = 'pakuringo:state';
const DAILY_GOAL = 30;
const PAIRS = [
  ['フェールセーフ', 'フールプルーフ'],
  ['予知保全', '予防保全'],
  ['信頼性設計', '機能安全'],
  ['MBD', 'デジタルツイン'],
  ['すり合わせ（インテグラル）型', 'モジュール設計'],
];

function todayStr(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return todayStr(d); }

function defaultState() {
  return {
    boxes: {}, seen: {}, correct: {}, xp: 0,
    hearts: 5, heartsDate: todayStr(),
    streakLast: '', streak: 0, bestStreak: 0,
    todayDate: todayStr(), todayXp: 0,
    lessonsDone: [],
  };
}
function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
  if (!s) {
    s = defaultState();
    // スペース版の進捗（デジタルツイン習熟・XP60）を初回だけ引き継ぐ
    Object.assign(s.boxes, SEED_STATE.boxes);
    Object.assign(s.seen, SEED_STATE.seen);
    Object.assign(s.correct, SEED_STATE.correct);
    s.xp = SEED_STATE.xp;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    return s;
  }
  const t = todayStr();
  if (s.heartsDate !== t) { s.hearts = 5; s.heartsDate = t; }
  if (s.todayDate !== t) { s.todayDate = t; s.todayXp = 0; }
  return s;
}
let S = loadState();
function persist() { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
function box(id) { return S.boxes[id] || 0; }
function cardById(id) { return CARDS.find(c => c.id === id); }
function cardByTitle(t) { return CARDS.find(c => c.title === t); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/* ---------- 画面切り替え ---------- */
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if (id === 'view-path') renderPath();
  if (id === 'view-cards') renderCards();
  if (id === 'view-records') renderRecords();
  renderStats();
  window.scrollTo(0, 0);
}
function renderStats() {
  document.getElementById('st-xp').textContent = S.xp;
  document.getElementById('st-streak').textContent = S.streak;
  document.getElementById('st-hearts').textContent = S.hearts;
  document.getElementById('st-today').textContent = S.todayXp;
}

/* ---------- レッスンパス ---------- */
const LESSONS = [];
for (let i = 0; i < CARDS.length; i += 5) LESSONS.push(CARDS.slice(i, i + 5));
function lessonUnlocked(idx) {
  if (idx === 0) return true;
  if (S.lessonsDone.includes(idx - 1)) return true;
  return LESSONS[idx].some(c => box(c.id) > 0);
}
function renderPath() {
  const doneN = S.lessonsDone.length;
  document.getElementById('path-badge').textContent = `${doneN}/${LESSONS.length} レッスン完了`;
  document.getElementById('lesson-list').innerHTML = LESSONS.map((cards, i) => {
    const done = S.lessonsDone.includes(i);
    const unlocked = lessonUnlocked(i);
    const cls = done ? 'done' : unlocked ? 'current' : 'locked';
    const node = done ? '✓' : unlocked ? String(i + 1) : '🔒';
    return `<div class="lesson ${cls}">
      <div class="node">${node}</div>
      <div class="l-body">
        <div class="l-name">レッスン ${i + 1}</div>
        <div class="l-words">${cards.map(c => esc(c.title)).join('、')}</div>
      </div>
      <button type="button" data-lesson="${i}" ${unlocked ? '' : 'disabled'}>${done ? 'もう一度' : 'スタート'}</button>
    </div>`;
  }).join('');
}
document.getElementById('lesson-list').addEventListener('click', e => {
  const b = e.target.closest('button[data-lesson]');
  if (!b || b.disabled) return;
  startLesson(Number(b.dataset.lesson));
});
document.getElementById('btn-review').addEventListener('click', () => {
  const pool = [...CARDS].sort((a, b2) => (box(a.id) - box(b2.id)) || ((S.seen[a.id] || 0) - (S.seen[b2.id] || 0))).slice(0, 10);
  startQuiz(pool.flatMap(c => [makeQuestion(c, null)]), null, '復習');
});

/* ---------- 問題生成 ---------- */
function shortDef(c) {
  const first = c.body.split('\n')[0];
  const idx = first.indexOf('。');
  const s = idx >= 0 ? first.slice(0, idx + 1) : first;
  return s.length > 72 ? s.slice(0, 72) + '…' : s;
}
function withChoices(answer, others) {
  const choices = shuffle([answer, ...others]);
  return { choices, answerIdx: choices.indexOf(answer) };
}
function otherCards(c, n) { return shuffle(CARDS.filter(x => x.id !== c.id)).slice(0, n); }

function mkT2D(c) {
  const o = otherCards(c, 3).map(x => shortDef(x));
  return { type: '用語→説明', cardId: c.id, prompt: `「${c.title}」の説明として正しいのはどれ？`, ...withChoices(shortDef(c), o) };
}
function mkD2T(c) {
  const o = otherCards(c, 3).map(x => x.title);
  return { type: '説明→用語', cardId: c.id, prompt: shortDef(c) + '\n――これは何の説明？', ...withChoices(c.title, o) };
}
function mkCloze(c) {
  if (!c.blanks.length) return null;
  const blank = c.blanks[Math.floor(Math.random() * c.blanks.length)];
  const pool = shuffle(CARDS.filter(x => x.id !== c.id).flatMap(x => x.blanks).filter(b => b !== blank));
  if (pool.length < 3) return null;
  const prompt = '次の文の（　　）に入るのは？\n' + c.body.replace(blank, '（　　）');
  return { type: '穴埋め', cardId: c.id, prompt, ...withChoices(blank, pool.slice(0, 3)) };
}
function mkScenario(c) {
  const hit = c.blanks.find(b => b === c.title || b.includes(c.title));
  if (!hit) return null;
  const prompt = '文脈から用語を当てる：次の文の（　　）に入る用語は？\n' + c.body.replace(hit, '（　　）');
  const o = otherCards(c, 3).map(x => x.title);
  return { type: '場面・応用', cardId: c.id, prompt, ...withChoices(c.title, o) };
}
function mkContrast(c) {
  const pair = PAIRS.find(p => p.includes(c.title));
  if (!pair) return null;
  const other = cardByTitle(pair.find(t => t !== c.title));
  if (!other) return null;
  const described = Math.random() < 0.5 ? c : other;
  const o = otherCards(c, 2).filter(x => x.id !== other.id).map(x => x.title);
  return { type: '対比・判別', cardId: c.id, prompt: '対比問題：次の説明に当てはまるのはどちら？\n' + shortDef(described), ...withChoices(described.title, [other.title === described.title ? c.title : other.title, ...o]) };
}
function mkRelated(c) {
  const rel = c.related.split('、').map(s => s.trim()).filter(t => t && t !== c.title && cardByTitle(t));
  if (!rel.length) return null;
  const ans = rel[Math.floor(Math.random() * rel.length)];
  const o = shuffle(CARDS.filter(x => x.title !== c.title && !rel.includes(x.title))).slice(0, 3).map(x => x.title);
  return { type: '関連キーワード', cardId: c.id, prompt: `「${c.title}」と関連が深い用語はどれ？`, ...withChoices(ans, o) };
}
const BUILDERS = { t2d: mkT2D, d2t: mkD2T, cloze: mkCloze, scenario: mkScenario, contrast: mkContrast, related: mkRelated };
function makeQuestion(c, prefer) {
  const b = box(c.id);
  let order;
  if (prefer) order = [prefer];
  else if (b <= 1) order = ['t2d', 'd2t', 'cloze'];
  else if (b <= 3) order = ['cloze', 'scenario', 'd2t', 'related'];
  else order = ['contrast', 'related', 'scenario', 'cloze'];
  order = [...order, 't2d', 'd2t', 'cloze', 'scenario', 'related', 'contrast'];
  for (const k of [...new Set(order)]) {
    const q = BUILDERS[k](c);
    if (q) return q;
  }
  return mkD2T(c);
}
function startLesson(idx) {
  const cards = LESSONS[idx];
  const qs = cards.flatMap(c => {
    const first = makeQuestion(c, null);
    let second = makeQuestion(c, null);
    if (second.type === first.type) second = makeQuestion(c, null);
    return [first, second];
  });
  startQuiz(shuffle(qs), idx, `レッスン ${idx + 1}`);
}

/* ---------- クイズ実行 ---------- */
let quiz = null;
function startQuiz(questions, lessonIdx, label) {
  // ハートが要るのはレッスンだけ。復習はハートが0でもでき、間違えても減らない
  // （ゲームの仕掛けで勉強そのものが止まらないように）。
  if (lessonIdx != null && S.hearts <= 0) { alert('ハートがありません（翌日に回復します）。今日は「復習する」ならハートなしで続けられます。'); return; }
  quiz = { queue: questions, idx: 0, correct: 0, xpEarned: 0, lessonIdx, label, answered: false };
  document.getElementById('quiz-main').hidden = false;
  document.getElementById('quiz-done').hidden = true;
  showView('view-quiz');
  renderQuestion();
}
function renderQuestion() {
  const q = quiz.queue[quiz.idx];
  const c = cardById(q.cardId);
  quiz.answered = false;
  document.getElementById('quiz-count').textContent = `${quiz.idx + 1}/${quiz.queue.length}`;
  document.getElementById('quiz-bar').style.width = `${(quiz.idx / quiz.queue.length) * 100}%`;
  document.getElementById('q-type').textContent = q.type;
  document.getElementById('q-prompt').textContent = q.prompt;
  document.getElementById('q-feedback').hidden = true;
  document.getElementById('q-choices').innerHTML = q.choices.map((ch, i) =>
    `<button type="button" data-i="${i}">${esc(ch)}</button>`).join('');
  document.getElementById('q-next').textContent = quiz.idx + 1 >= quiz.queue.length ? '結果を見る' : '次へ';
  renderStats();
}
document.getElementById('q-choices').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]');
  if (!b || quiz.answered) return;
  quiz.answered = true;
  const q = quiz.queue[quiz.idx];
  const c = cardById(q.cardId);
  const picked = Number(b.dataset.i);
  const ok = picked === q.answerIdx;
  document.querySelectorAll('#q-choices button').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answerIdx) btn.classList.add('correct');
    else if (i === picked) btn.classList.add('wrong');
  });
  S.seen[c.id] = (S.seen[c.id] || 0) + 1;
  if (ok) {
    quiz.correct++;
    quiz.xpEarned += 10;
    S.xp += 10;
    S.todayXp += 10;
    S.correct[c.id] = (S.correct[c.id] || 0) + 1;
    S.boxes[c.id] = Math.min(5, box(c.id) + 1);
  } else {
    if (quiz.lessonIdx != null) S.hearts = Math.max(0, S.hearts - 1);
    S.boxes[c.id] = Math.max(0, box(c.id) - 1);
  }
  persist();
  document.getElementById('q-verdict').textContent = ok ? '⭕ 正解！ +10 XP' : quiz.lessonIdx != null ? `❌ 不正解（ハート ${S.hearts}）` : '❌ 不正解（復習なのでハートは減りません）';
  document.getElementById('q-explain').textContent = `${c.title}\n${c.body}\n\n関連：${c.related} ／ 出題：${c.exam}`;
  document.getElementById('q-feedback').hidden = false;
  renderStats();
});
document.getElementById('q-next').addEventListener('click', () => {
  quiz.idx++;
  if (quiz.idx >= quiz.queue.length) finishQuiz();
  else renderQuestion();
});
document.getElementById('quiz-exit').addEventListener('click', () => { quiz = null; showView('view-path'); });
document.getElementById('btn-back-path').addEventListener('click', () => showView('view-path'));
function finishQuiz() {
  document.getElementById('quiz-bar').style.width = '100%';
  if (quiz.lessonIdx != null && !S.lessonsDone.includes(quiz.lessonIdx)) {
    S.lessonsDone.push(quiz.lessonIdx);
  }
  const t = todayStr();
  if (S.streakLast !== t) {
    S.streak = S.streakLast === yesterdayStr() ? S.streak + 1 : 1;
    S.streakLast = t;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
  }
  persist();
  document.getElementById('quiz-main').hidden = true;
  const done = document.getElementById('quiz-done');
  done.hidden = false;
  document.getElementById('done-text').innerHTML =
    `${esc(quiz.label)} 完了！<br>${quiz.queue.length}問中 ${quiz.correct}問正解 ／ +${quiz.xpEarned} XP<br>今日の合計 ${S.todayXp} XP（目標 ${DAILY_GOAL} XP）`;
  const record = {
    id: 'L' + Date.now(), kind: 'lesson', label: quiz.label,
    total: quiz.queue.length, correct: quiz.correct, xp: quiz.xpEarned,
    totalXp: S.xp, streak: S.streak,
    mastery: CARDS.map(c => ({ t: c.title, b: box(c.id) })),
  };
  quiz = null;
  renderStats();
  // Obsidian に残し、習慣「📘 技術士勉強」も立てる（gijutsushi/habit.js）
  if (window.GijutsushiHabit) window.GijutsushiHabit.markStudied(record);
}

/* ---------- カード一覧 ---------- */
function dots(boxN) {
  return `<span class="dots">${'●'.repeat(boxN)}<span class="off">${'●'.repeat(5 - boxN)}</span></span>`;
}
function renderCards() {
  const s = document.getElementById('card-search').value.trim();
  const list = CARDS.filter(c => !s || c.title.includes(s) || c.body.includes(s) || c.category.includes(s));
  document.getElementById('cards-badge').textContent = `${list.length}語`;
  document.getElementById('card-list').innerHTML = list.map(c => `
    <div class="kw-item">
      <div class="kw-head" data-kw="${c.id}">
        <span class="kw-title">${esc(c.title)}${c.added ? '<span class="added-badge">追加</span>' : ''}<br>
        <span class="kw-meta">${esc(c.category)} ／ ${esc(c.exam)}</span></span>
        ${dots(box(c.id))}
      </div>
      <div class="kw-body" data-kwbody="${c.id}" hidden>${esc(c.body)}\n\n関連：${esc(c.related)}</div>
    </div>`).join('') || '<p class="hint">見つかりませんでした。</p>';
}
document.getElementById('card-search').addEventListener('input', renderCards);
document.getElementById('card-list').addEventListener('click', e => {
  const head = e.target.closest('[data-kw]');
  if (!head) return;
  const body = document.querySelector(`[data-kwbody="${head.dataset.kw}"]`);
  if (body) body.hidden = !body.hidden;
});

/* ---------- 記録 ---------- */
function renderRecords() {
  const mastered = CARDS.filter(c => box(c.id) >= 5).length;
  const started = CARDS.filter(c => box(c.id) > 0).length;
  document.getElementById('records-summary').innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${S.xp}</div><div class="lbl">総XP</div></div>
      <div class="stat-box"><div class="num">${S.streak}日</div><div class="lbl">連続学習（最長 ${S.bestStreak}日）</div></div>
      <div class="stat-box"><div class="num">${mastered}/55</div><div class="lbl">習熟カード（ボックス5）</div></div>
      <div class="stat-box"><div class="num">${started}/55</div><div class="lbl">着手カード</div></div>
    </div>`;
  const cats = {};
  CARDS.forEach(c => { (cats[c.category] = cats[c.category] || []).push(c); });
  document.getElementById('records-cats').innerHTML = Object.keys(cats).sort().map(name => {
    const arr = cats[name];
    const pct = Math.round((arr.reduce((a, c) => a + box(c.id), 0) / (arr.length * 5)) * 100);
    return `<div class="cat-row"><span class="cat-name">${esc(name)}</span>
      <span class="cat-bar"><span class="cat-fill" style="width:${pct}%"></span></span>
      <span class="cat-num">${pct}%</span></div>`;
  }).join('');
}

/* ---------- バックアップ ---------- */
document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'pakuringo', version: 1, state: S }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pakuringo-progress.json';
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
      const st = d.state || d;
      if (!st || typeof st !== 'object' || !('boxes' in st)) throw new Error('形式が違います');
      S = Object.assign(defaultState(), st);
      persist(); renderStats(); renderRecords(); renderPath();
      alert('読み込みました。');
    } catch (err) { alert('読み込めませんでした: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('進捗をすべてリセットしますか？この操作は戻せません。')) return;
  S = defaultState();
  persist(); renderStats(); showView('view-path');
});

renderStats();
renderPath();
