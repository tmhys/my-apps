'use strict';
/* 技術士 勉強のバックアップ（キーワード学習＋論文骨子をまとめて1ファイル）。
 *
 * 記録は端末の localStorage にしかないので、消えるのを防ぐ仕組みをここに寄せる。
 * - 技術士ホームの「まとめてバックアップ」1タップで、共有シート（Obsidian・Google ドライブ・
 *   Dropbox など）に JSON を渡す。共有シートが使えない端末ではダウンロードする。
 * - 最後のバックアップから 7日以上たち、かつ中身が変わっていたら催促する
 *   （ホームは帯、各モジュールは1日1回のトースト）。
 * - 読み込みはまとめたファイルのほか、各モジュールが書き出した古い形式も受け付ける。
 *
 * Obsidian へは habit.js が記録ごとに送っている（骨子本文・キーワード習熟）。こちらは
 * 端末の移行や、中継が使えないときの控え。
 */
(function () {
  var K_PAKU = 'pakuringo:state';
  var K_OUTLINES = 'gijutsushi:outlines';
  var K_LAST = 'gijutsushi:lastBackup';      // { at: ISO, sig: string }
  var K_NAGGED = 'gijutsushi:backupNagged';  // 催促トーストを出した日
  var REMIND_DAYS = 7;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 致命的ではない */ } }
  function parse(s, d) { try { var v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }
  function ymd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 中身が変わったかを見るための簡単な指紋（FNV-1a）
  function sig() {
    var s = (get(K_PAKU) || '') + '|' + (get(K_OUTLINES) || '');
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16) + ':' + s.length;
  }
  function hasData() {
    var o = parse(get(K_OUTLINES), []);
    var p = parse(get(K_PAKU), null);
    return (Array.isArray(o) && o.length > 0) || !!(p && p.xp);
  }
  function last() { return parse(get(K_LAST), null); }

  // 催促が要るか。null なら不要、文字列ならその文言を出す
  function status() {
    if (!hasData()) return null;
    var l = last();
    if (l && l.sig === sig()) return null; // 前回から変わっていない
    if (!l) return 'まだ一度もバックアップしていません';
    var days = Math.floor((Date.now() - new Date(l.at).getTime()) / 86400000);
    if (days < REMIND_DAYS) return null;
    return '最後のバックアップから' + days + '日たっています';
  }

  function payload() {
    return {
      app: 'gijutsushi-all', version: 1, exportedAt: new Date().toISOString(),
      pakuringo: parse(get(K_PAKU), null),
      outlines: parse(get(K_OUTLINES), []),
    };
  }

  // 共有シート → ダメならダウンロード。戻り値: 'shared' | 'downloaded' | 'cancelled'
  function backupNow() {
    var name = 'gijutsushi-backup-' + ymd() + '.json';
    var text = JSON.stringify(payload(), null, 2);
    var mark = function () { set(K_LAST, JSON.stringify({ at: new Date().toISOString(), sig: sig() })); };
    var download = function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      mark();
      return 'downloaded';
    };
    var file;
    try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name })
        .then(function () { mark(); return 'shared'; })
        .catch(function (e) {
          if (e && e.name === 'AbortError') return 'cancelled';
          return download();
        });
    }
    return Promise.resolve(download());
  }

  // まとめたファイル・各モジュールの古い形式のどれでも読む
  function restore(text) {
    var d = JSON.parse(text);
    var done = [];
    if (d && d.app === 'gijutsushi-all') {
      if (d.pakuringo && typeof d.pakuringo === 'object') { set(K_PAKU, JSON.stringify(d.pakuringo)); done.push('キーワード学習'); }
      if (Array.isArray(d.outlines)) { set(K_OUTLINES, JSON.stringify(d.outlines)); done.push('論文骨子 ' + d.outlines.length + '本'); }
    } else if (d && d.app === 'pakuringo' && d.state) {
      set(K_PAKU, JSON.stringify(d.state)); done.push('キーワード学習');
    } else if (Array.isArray(d) || (d && Array.isArray(d.outlines))) {
      var arr = Array.isArray(d) ? d : d.outlines;
      set(K_OUTLINES, JSON.stringify(arr)); done.push('論文骨子 ' + arr.length + '本');
    }
    if (!done.length) throw new Error('技術士 勉強のバックアップではないようです');
    set(K_LAST, JSON.stringify({ at: new Date().toISOString(), sig: sig() })); // 読み込んだ直後は手元と同じ
    return done.join('・');
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);max-width:92vw;' +
      'background:#fff7e0;color:#5a4300;border:1px solid #e9cf7a;font-size:13px;line-height:1.6;' +
      'padding:10px 14px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:9998;';
    el.innerHTML = '';
    el.appendChild(document.createTextNode(msg + ' '));
    var a = document.createElement('a');
    a.href = '../';
    a.textContent = '技術士ホームで保存';
    a.style.cssText = 'color:#1e6b4f;font-weight:700;';
    el.appendChild(a);
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 6000);
  }

  // 各モジュールの画面で、1日1回だけ催促する
  function nagOnce() {
    var msg = status();
    if (!msg || get(K_NAGGED) === ymd()) return;
    set(K_NAGGED, ymd());
    toast('💾 ' + msg + '。');
  }

  window.GijutsushiBackup = { status: status, last: last, backupNow: backupNow, restore: restore, nagOnce: nagOnce };
})();
