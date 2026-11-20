'use strict';
/* 戻る操作（Android の戻る・ブラウザの戻る）を、見た目の階層どおりに動かす。全モジュール共通。
 *
 * これまでの問題:
 *  1) タブ・クイズ・ドリルなどの画面切り替えが履歴に残らないので、クイズ中に戻ると
 *     モジュールごと抜けて、技術士ホームやツール一覧まで戻ってしまっていた。
 *  2) 「← ○○に戻る」リンクが普通のページ移動として新しい履歴を積むので、
 *     リンクで戻ったあとに戻る操作をすると、いま抜けてきた画面にまた入ってしまっていた。
 *
 * やっていること:
 *  - MyNav.views(既定の画面, 表示関数, opts) で表示関数を包む。既定以外の画面に移ると
 *    履歴を1つだけ積み（タブを渡り歩いても積み増さず置き換える）、戻る操作で既定の画面に戻る。
 *    既定の画面で戻ると、ふつうに前のページ（上の階層）へ戻る。
 *    opts.canLeave(from, to) が false を返すと、戻る操作を取り消してその画面に留まる（入力中の保護）。
 *  - a.back（上の階層へのリンク）は、直前のページがその上の階層なら履歴を戻り、
 *    そうでなければ履歴を置き換えて移動する。どちらでも履歴が積み上がらない。
 */
(function () {
  var KEY = 'myNavView';

  function norm(u) {
    try {
      var x = new URL(u, location.href);
      return x.origin + x.pathname.replace(/index\.html$/, '');
    } catch (e) { return ''; }
  }
  function viewInState() { return (history.state && history.state[KEY]) || null; }
  function withView(id) {
    var s = Object.assign({}, history.state || {});
    if (id) s[KEY] = id; else delete s[KEY];
    return s;
  }

  // ---- 上の階層へのリンク
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a.back');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var target = new URL(a.getAttribute('href'), location.href).href;
    e.preventDefault();
    if (document.referrer && norm(document.referrer) === norm(target) && history.length > 1) {
      history.go(viewInState() ? -2 : -1); // 画面切り替えの分も一緒に戻る
    } else {
      location.replace(target);
    }
  });

  // ---- ページ内の画面切り替え
  function views(defaultView, show, opts) {
    opts = opts || {};
    var current = defaultView;
    var internal = false; // go() 自身が history.back() したときは canLeave を聞かない

    // 再読み込みなどで「画面を積んだ履歴」の上から始まったときは、既定の画面の履歴に戻しておく
    if (viewInState()) history.replaceState(withView(null), '');

    function go(id) {
      if (id === defaultView) {
        if (viewInState()) {
          internal = true;
          history.back(); // popstate で既定の画面を出す
          return;
        }
        current = id;
        show(id);
        return;
      }
      if (viewInState()) history.replaceState(withView(id), '');
      else history.pushState(withView(id), '');
      current = id;
      show(id);
    }

    window.addEventListener('popstate', function () {
      var next = viewInState() || defaultView;
      var wasInternal = internal;
      internal = false;
      if (next === current) return;
      if (!wasInternal && opts.canLeave && !opts.canLeave(current, next)) {
        history.pushState(withView(current), ''); // 戻る操作を取り消す
        return;
      }
      current = next;
      show(next);
    });

    return go;
  }

  window.MyNav = { views: views };
})();
