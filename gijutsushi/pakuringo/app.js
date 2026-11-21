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
    lastAt: {}, // カードごとに最後に解いた時刻（復習の選び方に使う）
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
  if (!s.lastAt) s.lastAt = {};
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
// 戻る操作でレッスン一覧に戻す（クイズ中に戻ってもモジュールから抜けない。../../nav.js）
showView = MyNav.views('view-path', showView);
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
        <div class="l-words">${esc(Abbr.expand(cards.map(c => c.title).join('、')))}</div>
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
// 復習の10枚: 習熟度が低いカードを優先しつつ、直近6時間に解いたカードは後回しにし、
// 同じくらいのカード同士は乱順にする（以前は並びが固定で、毎回ほぼ同じ10枚になっていた）。
const RECENT_MS = 6 * 3600 * 1000;
function reviewScore(c, now) {
  const recent = S.lastAt[c.id] && now - S.lastAt[c.id] < RECENT_MS;
  return box(c.id) * 10 + (recent ? 15 : 0) + Math.random() * 6;
}
document.getElementById('btn-review').addEventListener('click', () => {
  const now = Date.now();
  const pool = [...CARDS].map(c => ({ c, k: reviewScore(c, now) })).sort((a, b2) => a.k - b2.k).slice(0, 10).map(x => x.c);
  startQuiz(shuffle(pool).map(c => makeQuestion(c, null)), null, '復習');
});

/* ---------- 問題生成 ----------
   カードの本文は「〜する手法＝トポロジー最適化。」の形で用語を含むので、そのまま出すと
   問題文や選択肢に答えが載ってしまう。出題前に必ず用語を「〇〇」で伏せる（mask）。
   誤答の選択肢は、同じ分野・対比ペア・関連語から優先して選び、消去法で解けないようにする。 */
const MASK = '〇〇';
// 自動の分解（括弧・中黒）では拾えない言い換え。これも伏せる。
const ALIASES = {
  'AI・機械学習の活用': ['機械学習', 'AI'],
  'CAEのV&V': ['V&V', 'Verification', 'Validation'],
  '熱設計（熱膨張対策）': ['熱膨張'],
  '疲労設計': ['疲労'],
  '信頼性設計': ['信頼性'],
  '振動・共振': ['共振'],
  'フィードバック制御・PID': ['PID制御'],
  '品質マネジメント（ISO 9001）': ['ISO 9001'],
};
function titleVariants(c) {
  if (c._variants) return c._variants;
  const parts = [c.title, ...c.title.split(/[（）()・／]/)].map(t => t.trim()).filter(t => t.length >= 2);
  const v = [...new Set([...parts, ...(ALIASES[c.title] || [])])].sort((x, y) => y.length - x.length);
  return (c._variants = v);
}
function escRe(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// 英字の語は単語の途中では伏せない（DR が DRBFM を壊さないように）
function wordRe(t) {
  const ascii = /^[A-Za-z0-9&]+$/.test(t);
  return new RegExp(ascii ? `(?<![A-Za-z])${escRe(t)}(?![A-Za-z])` : escRe(t), 'g');
}
function maskWords(text, words) {
  let out = text;
  words.forEach(w => { out = out.replace(wordRe(w), MASK); });
  // 「＝〇〇（ポカヨケ）」のような定義の締めは丸ごと落とす（括弧の中に別名が入っていることが多い）
  out = out.replace(/＝〇〇(?:（(?:[^（）]|（[^（）]*）)*）)*/g, '');
  return out.replace(/(〇〇)+/g, MASK);
}
function maskCard(c, text) { return maskWords(text, titleVariants(c)); }
function shortDef(c) {
  const lines = maskCard(c, c.body).split('\n');
  let s = '';
  for (const line of lines) {
    for (const sent of line.split(/(?<=。)/)) {
      s += sent;
      if (s.length >= 24) break;
    }
    if (s.length >= 24) break;
  }
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
}
function withChoices(answer, others) {
  const choices = shuffle([answer, ...others]);
  return { choices, answerIdx: choices.indexOf(answer) };
}
// 紛らわしい順に並べた他のカード（対比ペア > 関連語 > 同じ分野 > その他。同点は乱順）
function similarCards(c) {
  const pair = PAIRS.find(p => p.includes(c.title));
  const rel = c.related.split('、').map(t => t.trim());
  return shuffle(CARDS.filter(x => x.id !== c.id))
    .map(x => ({ x, score: (pair && pair.includes(x.title) ? 4 : 0) + (rel.includes(x.title) ? 2 : 0) + (x.category === c.category ? 2 : 0) + Math.random() }))
    .sort((p, q) => q.score - p.score)
    .map(p => p.x);
}
// 問題文に出てしまっている語・重複を除いて n 個選ぶ
function pickDistinct(cands, n, prompt, answer) {
  const out = [];
  for (const t of cands) {
    if (out.length >= n) break;
    if (!t || t === answer || out.includes(t)) continue;
    if (prompt && prompt.includes(t)) continue;
    if (answer.includes(t) || t.includes(answer)) continue;
    out.push(t);
  }
  return out.length === n ? out : null;
}
function titleChoices(c, prompt, n) {
  const cands = similarCards(c).map(x => x.title);
  return pickDistinct(cands, n, prompt, c.title);
}

function mkT2D(c) {
  const ans = shortDef(c);
  // 他のカードの説明にこの用語が出てくることがある（予防保全の説明に「予知保全は…」）ので、そこも伏せる
  const others = pickDistinct(similarCards(c).map(x => maskCard(c, shortDef(x))), 3, '', ans);
  if (!others) return null;
  return { type: '用語→説明', cardId: c.id, prompt: `「${c.title}」の説明として正しいのはどれ？`, ...withChoices(ans, others) };
}
function mkD2T(c) {
  const prompt = shortDef(c) + '\n――これは何の説明？';
  const o = titleChoices(c, prompt, 3);
  if (!o) return null;
  return { type: '説明→用語', cardId: c.id, prompt, ...withChoices(c.title, o) };
}
function mkCloze(c) {
  const blanks = shuffle(c.blanks);
  for (const blank of blanks) {
    // 「フールプルーフ（ポカヨケ）」のように用語を含む穴も、用語そのものが答えとして扱う
    const isTitle = titleVariants(c).some(v => blank.includes(v));
    // 答えの語はすべて伏せる。用語そのものが答えなら、言い換えも伏せる。
    let text = c.body.split(blank).join('（　　）');
    if (isTitle) text = maskCard(c, text);
    if (text.includes(blank)) continue;
    const prompt = '次の文の（　　）に入るのは？\n' + text;
    let cands;
    if (isTitle) {
      cands = similarCards(c).map(x => x.title);
    } else {
      // 同じ分野で長さが近い穴埋め語を優先
      const len = blank.length;
      cands = similarCards(c).flatMap(x => x.blanks.filter(b => !CARDS.some(y => y.title === b)))
        .map(b => ({ b, d: Math.abs(b.length - len) / Math.max(len, 4) }))
        .filter(p => p.d <= 1)
        .map(p => p.b);
    }
    const o = pickDistinct(cands, 3, prompt, blank);
    if (o) return { type: '穴埋め', cardId: c.id, prompt, ...withChoices(blank, o) };
  }
  return null;
}
function mkScenario(c) {
  // 本文の2文目以降（特徴・使い方）から用語を当てる。定義文そのものより一段難しい。
  const rest = c.body.split('\n').slice(1).join('\n').trim();
  if (rest.length < 20) return null;
  const prompt = '特徴から用語を当てる：次の特徴をもつのは？\n' + maskCard(c, rest);
  const o = titleChoices(c, prompt, 3);
  if (!o) return null;
  return { type: '場面・応用', cardId: c.id, prompt, ...withChoices(c.title, o) };
}
function mkContrast(c) {
  const pair = PAIRS.find(p => p.includes(c.title));
  if (!pair) return null;
  const other = cardByTitle(pair.find(t => t !== c.title));
  if (!other) return null;
  const described = Math.random() < 0.5 ? c : other;
  const notDescribed = described === c ? other : c;
  // 対になる用語も伏せる（「予知保全は実際の劣化状態を見る」のような比較の一文で分かってしまうため）
  const prompt = '対比問題：次の説明に当てはまるのはどれ？\n' + maskWords(shortDef(described), titleVariants(notDescribed));
  const more = pickDistinct(similarCards(described).map(x => x.title).filter(t => t !== notDescribed.title), 2, prompt, described.title);
  if (!more) return null;
  return { type: '対比・判別', cardId: c.id, prompt, ...withChoices(described.title, [notDescribed.title, ...more]) };
}
function mkRelated(c) {
  const rel = c.related.split('、').map(s => s.trim()).filter(t => t && t !== c.title && cardByTitle(t));
  if (!rel.length) return null;
  const ans = rel[Math.floor(Math.random() * rel.length)];
  // 誤答は同じ分野の用語から（関連語・自分自身は除く）
  const cands = similarCards(c).map(x => x.title).filter(t => !rel.includes(t));
  const o = pickDistinct(cands, 3, '', ans);
  if (!o) return null;
  return { type: '関連キーワード', cardId: c.id, prompt: `「${c.title}」と関連が深い用語はどれ？`, ...withChoices(ans, o) };
}
const BUILDERS = { t2d: mkT2D, d2t: mkD2T, cloze: mkCloze, scenario: mkScenario, contrast: mkContrast, related: mkRelated };
// 習熟度に合った形式の中から乱順で選ぶ（以前は順番が固定で、いつも同じ形式になっていた）。
// avoid に渡した形式は避ける（同じカードの2問目を別の形式にするため）。
function makeQuestion(c, prefer, avoid) {
  const b = box(c.id);
  let order;
  if (prefer) order = [prefer];
  else if (b <= 1) order = shuffle(['t2d', 'd2t', 'cloze']);
  else if (b <= 3) order = shuffle(['cloze', 'scenario', 'd2t', 'related']);
  else order = shuffle(['contrast', 'related', 'scenario', 'cloze']);
  order = [...order, ...shuffle(['t2d', 'd2t', 'cloze', 'scenario', 'related', 'contrast'])];
  for (const k of [...new Set(order)]) {
    if (k === avoid) continue;
    const q = BUILDERS[k](c);
    if (q) return Object.assign(q, { kind: k });
  }
  return Object.assign(mkT2D(c) || mkD2T(c), { kind: 't2d' }); // 用語→説明は全カードで必ず作れる
}
// レッスンは5枚×2問。1周目で5枚を1問ずつ、2周目で別の形式でもう1問ずつ出す
// （以前は10問をまとめて混ぜていたので、同じカードが続けて出ることがあった）。
function startLesson(idx) {
  const cards = LESSONS[idx];
  const firsts = shuffle(cards).map(c => makeQuestion(c, null));
  const seconds = shuffle(cards).map(c => makeQuestion(c, null, firsts.find(q => q.cardId === c.id).kind));
  // 1周目の最後と2周目の最初が同じカードにならないように
  if (seconds[0].cardId === firsts[firsts.length - 1].cardId) seconds.push(seconds.shift());
  startQuiz([...firsts, ...seconds], idx, `レッスン ${idx + 1}`);
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
  // 略語に正式名称を添える（../abbr.js）。問題文では答えになる語を含む名称は添えない。
  const ans = q.choices[q.answerIdx];
  const ansCard = cardByTitle(ans);
  const avoid = [ans, ...(ansCard ? titleVariants(ansCard) : [])];
  document.getElementById('q-prompt').textContent = Abbr.expand(q.prompt, { avoid });
  document.getElementById('q-feedback').hidden = true;
  document.getElementById('q-choices').innerHTML = q.choices.map((ch, i) =>
    `<button type="button" data-i="${i}">${esc(Abbr.expand(ch))}</button>`).join('');
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
  S.lastAt[c.id] = Date.now();
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
  document.getElementById('q-explain').textContent = Abbr.expand(`${c.title}\n${c.body}\n\n関連：${c.related} ／ 出題：${c.exam}`);
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
  document.getElementById('card-list').innerHTML = list.map(c => { const seen = new Set(); return `
    <div class="kw-item">
      <div class="kw-head" data-kw="${c.id}">
        <span class="kw-title">${esc(Abbr.expand(c.title, { seen }))}${c.added ? '<span class="added-badge">追加</span>' : ''}<br>
        <span class="kw-meta">${esc(c.category)} ／ ${esc(c.exam)}</span></span>
        ${dots(box(c.id))}
      </div>
      <div class="kw-body" data-kwbody="${c.id}" hidden>${esc(Abbr.expand(`${c.body}\n\n関連：${c.related}`, { seen }))}</div>
    </div>`; }).join('') || '<p class="hint">見つかりませんでした。</p>';
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
