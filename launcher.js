'use strict';
/* ランチャーの表示。各ツールが端末に残している記録を読んで、
   カードの小さな状況と「次にやること」を決める。サーバーには問い合わせない
   （開いた瞬間に出したいので。立替精算・買い物メモは最後に開いたときの内容）。

   読むもの（どれも同じオリジンの localStorage）
   - workoutLogPwa.summary … ワークアウトが自分で書く要約（ブラウザ版で開いたときだけ。
     Android アプリ版の記録はアプリの中にあり、ここからは見えない）
   - pakuringo:state       … 技術士のキーワード学習
   - shopping:cache        … 買い物メモの最後の一覧
   - reimburse:cache       … 立替精算の最後の集計 */
(function () {
  function ls(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var now = new Date();
  var today = ymd(now);
  var monday = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7));

  // ---- 見出し ----
  var h = now.getHours();
  document.getElementById('hello').textContent =
    h < 5 ? 'GOOD NIGHT' : h < 11 ? 'GOOD MORNING' : h < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  document.getElementById('today').textContent =
    (now.getMonth() + 1) + '/' + now.getDate() + '（' + '日月火水木金土'[now.getDay()] + '）';

  // ---- 各ツールの状況 ----
  var st = {};

  var w = ls('workoutLogPwa.summary');
  if (w && w.at) {
    var thisWeek = w.at >= monday;
    st.workout = {
      week: thisWeek ? w.week : 0,
      target: w.target || 3,
      doneToday: w.at === today && w.doneToday,
      next: w.next || '',
    };
  }

  var p = ls('pakuringo:state');
  if (p) {
    st.gijutsushi = {
      xp: p.todayDate === today ? (p.todayXp || 0) : 0,
      goal: 30, // pakuringo の DAILY_GOAL と合わせる
      streak: (p.streakLast === today || p.streakLast === ymd(new Date(now.getTime() - 864e5))) ? (p.streak || 0) : 0,
    };
  }

  var sh = ls('shopping:cache');
  if (sh && sh.list && Array.isArray(sh.list.waiting)) st.shopping = { waiting: sh.list.waiting.length };

  var rb = ls('reimburse:cache');
  if (rb && rb.model && typeof rb.model.itemCount === 'number') st.reimburse = { count: rb.model.itemCount };

  function setStat(k, text) {
    var el = document.querySelector('[data-stat="' + k + '"]');
    if (el && text) { el.textContent = text; el.classList.add('live'); }
  }
  if (st.workout) setStat('workout', '今週 ' + st.workout.week + '/' + st.workout.target + '回' + (st.workout.doneToday ? ' ✓' : ''));
  if (st.gijutsushi) setStat('gijutsushi', '今日 ' + st.gijutsushi.xp + '/' + st.gijutsushi.goal + ' XP');
  if (st.shopping) setStat('shopping', st.shopping.waiting ? '発注待ち ' + st.shopping.waiting + '件' : '発注待ちなし');
  if (st.reimburse) setStat('reimburse', st.reimburse.count ? '未精算 ' + st.reimburse.count + '件' : '未精算なし');

  // 上の小さな要約（見るだけ）
  var pills = [];
  if (st.workout) pills.push(['筋トレ', st.workout.week + '/' + st.workout.target, '回']);
  if (st.gijutsushi && st.gijutsushi.streak) pills.push(['技術士', st.gijutsushi.streak, '日連続']);
  if (st.reimburse && st.reimburse.count) pills.push(['未精算', st.reimburse.count, '件']);
  var pillsEl = document.getElementById('pills');
  pills.forEach(function (x) {
    var s = document.createElement('span');
    s.appendChild(document.createTextNode(x[0] + ' '));
    var b = document.createElement('b'); b.textContent = x[1];
    s.appendChild(b);
    s.appendChild(document.createTextNode(' ' + x[2]));
    pillsEl.appendChild(s);
  });

  // ---- 次にやること ----
  // 上から順に、当てはまった最初の1つ。習慣（筋トレ・勉強）を先に、用事（買い物・精算）を後に。
  var workoutHref = function () { return document.getElementById('workout-card').getAttribute('href'); };
  var plan = [
    function () {
      var x = st.workout;
      if (x && !x.doneToday && x.week < x.target) return ['筋トレ ' + (x.next || ''), workoutHref()];
    },
    function () {
      var x = st.gijutsushi;
      if (!x) return ['技術士 キーワード学習', './gijutsushi/pakuringo/'];
      if (x.xp < x.goal) return ['技術士 キーワード（あと ' + (x.goal - x.xp) + ' XP）', './gijutsushi/pakuringo/'];
    },
    function () {
      var x = st.shopping;
      if (x && x.waiting) return ['買い物 発注待ち ' + x.waiting + '件', './shopping/'];
    },
    function () {
      var x = st.reimburse;
      if (x && x.count) return ['立替の精算 ' + x.count + '件', './reimburse/'];
    },
  ];
  var next = null;
  for (var i = 0; i < plan.length && !next; i++) next = plan[i]();
  var nextEl = document.getElementById('next');
  if (next) {
    document.getElementById('next-label').textContent = next[0];
    nextEl.setAttribute('href', next[1]);
  } else {
    document.getElementById('next-label').textContent = '今日のぶんは済みました';
    nextEl.classList.add('clear');
    nextEl.setAttribute('href', workoutHref());
    nextEl.querySelector('.go').textContent = '筋トレ';
  }

  // ---- ホーム画面に置く ----
  var sheet = document.getElementById('pin-sheet');
  document.getElementById('btn-pin').addEventListener('click', function () { sheet.hidden = false; });
  document.getElementById('pin-close').addEventListener('click', function () { sheet.hidden = true; });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.hidden = true; });
})();
