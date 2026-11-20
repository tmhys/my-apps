'use strict';
/* 勉強した日に、習慣グリッド（tmhys/habit-pwa）の「📘 技術士勉強」を自動でチェックする。
 *
 * - 記録は habit-pwa と同じ habit-relay（tmhys/gas の GAS）に送る。
 *   my-apps と habit-pwa はどちらも https://tmhys.github.io 配下なので localStorage を共有しており、
 *   習慣グリッドの⚙️で入れた中継URL・合言葉（habitRelayUrl / habitRelayToken）をそのまま使う。
 *   ここでは新しく何も保存しない（URL・合言葉をこのリポジトリに書かない方針も守れる）。
 * - 1日1回だけ送る。送信済みの日は gijutsushi:habitSent に覚える。
 *   習慣グリッド側で既に付いている日（Tasker や手動）は、スナップショットを見て送らない。
 * - 送れなかったとき（圏外など）は gijutsushi:studied に「勉強した日」を残し、
 *   次にどちらかの画面を開いたときに送り直す（当日中のみ）。
 * - 送ったら habitPendingRecords に積むので、習慣グリッドを開くとすぐ ✓ が見える。
 */
(function () {
  var HABIT_ID = 'gijutsushi';
  var SNAPSHOT_URL = 'https://tmhys.github.io/habit-pwa/data/habits.json';
  var K_STUDIED = 'gijutsushi:studied';
  var K_SENT = 'gijutsushi:habitSent';
  var sending = false;

  function ymd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 致命的ではない */ } }

  function toast(msg) {
    var el = document.getElementById('habit-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'habit-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);max-width:90vw;' +
        'background:#22302a;color:#fff;font-size:13px;line-height:1.6;padding:10px 14px;border-radius:12px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;transition:opacity .3s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 3500);
  }

  // 習慣グリッドのスナップショットに今日が既にあるか（取れなければ「無い」扱いで送る）
  function alreadyInSnapshot(today) {
    return fetch(SNAPSHOT_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var h = d && (d.habits || []).find(function (x) { return x.id === HABIT_ID; });
        return !!(h && (h.done || []).indexOf(today) >= 0);
      })
      .catch(function () { return false; });
  }

  function addPending(today) {
    var list;
    try { list = JSON.parse(get('habitPendingRecords') || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    if (!list.some(function (p) { return p.habit === HABIT_ID && p.ymd === today; })) {
      list.push({ habit: HABIT_ID, ymd: today, sentAt: Date.now() });
      set('habitPendingRecords', JSON.stringify(list));
    }
  }

  function flush(quiet) {
    var today = ymd();
    if (get(K_STUDIED) !== today || get(K_SENT) === today || sending) return Promise.resolve();
    var url = get('habitRelayUrl');
    var token = get('habitRelayToken');
    if (!url || !token) {
      if (!quiet) toast('習慣グリッドの⚙️で記録の設定をすると、勉強した日に自動でチェックが付きます');
      return Promise.resolve();
    }
    sending = true;
    return alreadyInSnapshot(today).then(function (done) {
      if (done) { set(K_SENT, today); return; }
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // CORSプリフライトを避ける（habit-pwa と同じ）
        body: JSON.stringify({ token: token, habit: HABIT_ID, epoch: String(Math.floor(Date.now() / 1000)) }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error((d && d.error) || 'unknown error');
          set(K_SENT, today);
          addPending(today);
          toast('📘 習慣グリッドの「技術士勉強」に今日のチェックを付けました');
        });
    }).catch(function (e) {
      if (!quiet) toast('習慣のチェックを送れませんでした（次に開いたときに送り直します）: ' + (e.message || e));
    }).then(function () { sending = false; });
  }

  // 勉強した（レッスン完了・骨子保存など）ときに呼ぶ
  function markStudied() {
    set(K_STUDIED, ymd());
    return flush(false);
  }

  window.GijutsushiHabit = { markStudied: markStudied, flush: flush };
  // 前回送れなかった分を送り直す
  flush(true);
})();
