'use strict';
/* 勉強の記録を Obsidian（tmhys/github_obsidian）に送り、習慣グリッドの「📘 技術士勉強」を立てる。
 *
 * 送り先は habit-pwa と同じ habit-relay（tmhys/gas の GAS）。
 *   my-apps と habit-pwa はどちらも https://tmhys.github.io 配下なので localStorage を共有しており、
 *   習慣グリッドの⚙️で入れた中継URL・合言葉（habitRelayUrl / habitRelayToken）をそのまま使う。
 *   ここでは新しく何も保存しない（URL・合言葉をこのリポジトリに書かない方針も守れる）。
 *
 * 1) 記録（骨子1本・レッスン1回）は action:"gijutsushi" で送る。受け側の gijutsushi-log.yml が
 *    10_Gijutsushi/ と 05_Stream に書き、習慣も同じ workflow で立てる（習慣を別に送らない）。
 *    端末の localStorage にしかない記録のバックアップを兼ねる。
 *    送れなかったものは gijutsushi:outbox に溜め、次にどの画面を開いたときにも送り直す。
 *    同じ id を送り直しても受け側が書き換えるので増えない。
 * 2) 中継役がまだ古い版（action:"gijutsushi" を知らない）ときは、習慣だけを1日1回送る。
 *    記録は outbox に残しておき、中継役を更新したあとで送る（古い版かどうかは1日1回見直す）。
 *    習慣グリッド側で既に付いている日（Tasker や手動）は、スナップショットを見て送らない。
 */
(function () {
  var HABIT_ID = 'gijutsushi';
  var SNAPSHOT_URL = 'https://tmhys.github.io/habit-pwa/data/habits.json';
  var K_STUDIED = 'gijutsushi:studied';
  var K_SENT = 'gijutsushi:habitSent';
  var K_OUTBOX = 'gijutsushi:outbox';
  var K_OLD_RELAY = 'gijutsushi:oldRelayDay'; // 古い中継役だと分かった日
  var OUTBOX_MAX = 40;
  var MAX_TRIES = 5;
  var sending = false;
  var again = false; // 送信中に新しい記録が来たら、終わってからもう一度回す

  function ymd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 致命的ではない */ } }
  function outbox() {
    try { var l = JSON.parse(get(K_OUTBOX) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function setOutbox(l) { set(K_OUTBOX, JSON.stringify(l.slice(-OUTBOX_MAX))); }

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

  // 'ok' | 'old'（中継役が古い）| 'retry'（通信の不調）| Error（内容の不備）
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // CORSプリフライトを避ける（habit-pwa と同じ）
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) return 'retry';
      return r.json().then(function (d) {
        if (d && d.ok) return 'ok';
        var err = String((d && d.error) || 'unknown error');
        // 古い中継役は action を知らず、習慣の記録として扱って id が無いと言う
        if (/invalid habit id/.test(err)) return 'old';
        throw new Error(err);
      }, function () { return 'retry'; });
    }, function () { return 'retry'; });
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

  // 習慣グリッドが送信済みとして表示に混ぜる（反映されたら向こうが消す）
  function addPending(day) {
    var list;
    try { list = JSON.parse(get('habitPendingRecords') || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    if (!list.some(function (p) { return p.habit === HABIT_ID && p.ymd === day; })) {
      list.push({ habit: HABIT_ID, ymd: day, sentAt: Date.now() });
      set('habitPendingRecords', JSON.stringify(list));
    }
  }

  // 1) 記録を順に送る。戻り値: 送れた件数
  function flushRecords(url, token) {
    var today = ymd();
    if (get(K_OLD_RELAY) === today) return Promise.resolve(0);
    var sent = 0;
    var items = outbox();
    var i = 0;
    function next() {
      if (i >= items.length) return Promise.resolve(sent);
      var item = items[i++];
      return post(url, { token: token, action: 'gijutsushi', record: item.record }).then(function (r) {
        if (r === 'old') { set(K_OLD_RELAY, today); return sent; }
        if (r === 'retry') return sent; // 圏外なら以降も同じ
        setOutbox(outbox().filter(function (x) { return x.record.id !== item.record.id; }));
        var day = ymd(new Date(item.record.epoch * 1000));
        if (day === today) set(K_SENT, today); // 習慣は受け側で立つ
        addPending(day);
        sent++;
        return next();
      }, function (err) {
        var l = outbox();
        var it = l.find(function (x) { return x.record.id === item.record.id; });
        if (it) {
          it.tries = (it.tries || 0) + 1;
          it.error = String(err.message || err);
          setOutbox(it.tries >= MAX_TRIES ? l.filter(function (x) { return x !== it; }) : l);
        }
        return next();
      });
    }
    return next();
  }

  // 2) 習慣だけを送る（中継役が古いとき・記録が送れなかったとき）
  function flushHabit(url, token, quiet) {
    var today = ymd();
    if (get(K_STUDIED) !== today || get(K_SENT) === today) return Promise.resolve();
    return alreadyInSnapshot(today).then(function (done) {
      if (done) { set(K_SENT, today); return; }
      return post(url, { token: token, habit: HABIT_ID, epoch: String(Math.floor(Date.now() / 1000)) }).then(function (r) {
        if (r !== 'ok') throw new Error('通信できませんでした');
        set(K_SENT, today);
        addPending(today);
        if (!quiet) toast('📘 習慣グリッドの「技術士勉強」に今日のチェックを付けました');
      });
    });
  }

  function flush(quiet) {
    if (sending) { again = again || (quiet ? 'quiet' : 'loud'); return Promise.resolve(); }
    var url = get('habitRelayUrl');
    var token = get('habitRelayToken');
    var pendingWork = outbox().length || (get(K_STUDIED) === ymd() && get(K_SENT) !== ymd());
    if (!pendingWork) return Promise.resolve();
    if (!url || !token) {
      if (!quiet) toast('習慣グリッドの⚙️で記録の設定をすると、勉強の記録が Obsidian と習慣グリッドに自動で残ります');
      return Promise.resolve();
    }
    sending = true;
    return flushRecords(url, token)
      .then(function (n) {
        if (n && !quiet) toast('📘 Obsidian に記録しました（習慣「技術士勉強」も付きます）');
        return flushHabit(url, token, quiet);
      })
      .catch(function (e) {
        if (!quiet) toast('送れませんでした（次に開いたときに送り直します）: ' + (e.message || e));
      })
      .then(function () {
        sending = false;
        if (again) { var q = again === 'quiet'; again = false; return flush(q); }
      });
  }

  // 勉強した（レッスン完了・骨子保存など）ときに呼ぶ。record は Obsidian に残す中身
  function markStudied(record) {
    set(K_STUDIED, ymd());
    if (record && record.id) {
      record.epoch = record.epoch || Math.floor(Date.now() / 1000);
      var l = outbox().filter(function (x) { return x.record.id !== record.id; }); // 同じ記録は最新の1件だけ
      l.push({ record: record, tries: 0 });
      setOutbox(l);
    }
    return flush(false);
  }

  window.GijutsushiHabit = { markStudied: markStudied, flush: flush, outbox: outbox };
  // 前回送れなかった分を送り直す
  flush(true);
})();
