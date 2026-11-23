'use strict';
/* ツールを単体でホーム画面に置くための小さな仕掛け。
   立替精算・買い物メモ・技術士勉強はそれぞれ自分の manifest を持っているので、
   そのページで Chrome の「インストール」を呼べば、ツール単体のアイコンになる。

   ランチャーの「ホーム画面に置く」から ?install=1 付きで開かれたときだけ、下に案内を出す。
   普段開いたときは何も出さない（Chrome が自分で出す案内も止めておく。毎回出るとうるさいため）。
   Chrome が「インストール」を出せない場面（すでに置いてある、iPhone など）は手順を文字で示す。 */
(function () {
  var want = /[?&]install=1\b/.test(location.search);
  var deferred = null;
  var sheet = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (sheet) render();
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (sheet) render('done');
  });

  if (!want) return;

  // 再読み込みしても案内が出続けないよう、?install=1 は消しておく
  try {
    var u = new URL(location.href);
    u.searchParams.delete('install');
    history.replaceState(null, '', u.toString());
  } catch (e) { /* 古いブラウザでは URL に残るだけ */ }

  var name = (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content ||
    document.title;
  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  var css = document.createElement('style');
  css.textContent =
    '.inst-sheet{position:fixed;left:0;right:0;bottom:0;z-index:100;padding:18px 18px calc(18px + env(safe-area-inset-bottom));' +
    'background:#141c18;color:#e8efe9;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.25);' +
    'font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}' +
    '.inst-sheet h3{margin:0 0 6px;font-size:16px}' +
    '.inst-sheet p{margin:0 0 14px;font-size:13px;line-height:1.7;color:#a9c3b6}' +
    '.inst-sheet .inst-row{display:flex;gap:8px}' +
    '.inst-sheet button{font:inherit;font-size:14px;font-weight:700;border-radius:14px;padding:13px 12px;border:0;cursor:pointer}' +
    '.inst-sheet .inst-go{flex:1;background:#1f8a63;color:#fff}' +
    '.inst-sheet .inst-close{background:rgba(255,255,255,.08);color:#e8efe9}';
  document.head.appendChild(css);

  sheet = document.createElement('div');
  sheet.className = 'inst-sheet';
  document.body.appendChild(sheet);

  function close() { sheet.remove(); sheet = null; }

  function render(state) {
    var title = '「' + name + '」をホーム画面に置く';
    var text, go = '';
    if (state === 'done') {
      text = 'ホーム画面に置きました。次からはそのアイコンから直接開けます。';
    } else if (standalone) {
      text = 'すでにアプリとして開いています。';
    } else if (deferred) {
      text = 'このツールだけのアイコンができます。マイツールを開かずに、直接ここへ来られます。';
      go = '<button type="button" class="inst-go">ホーム画面に置く</button>';
    } else if (ios) {
      text = '下の共有ボタン（□に↑）→「ホーム画面に追加」で置けます。';
    } else if (state === 'wait') {
      text = '準備しています…';
    } else {
      text = 'Chrome 右上の「⋮」→「ホーム画面に追加」（または「アプリをインストール」）で置けます。' +
        'すでに置いてある場合は、ホーム画面のアイコンから開いてください。';
    }
    sheet.innerHTML = '<h3></h3><p></p><div class="inst-row">' + go +
      '<button type="button" class="inst-close">' + (state === 'done' ? '閉じる' : 'あとで') + '</button></div>';
    sheet.querySelector('h3').textContent = title;
    sheet.querySelector('p').textContent = text;
    sheet.querySelector('.inst-close').addEventListener('click', close);
    var btn = sheet.querySelector('.inst-go');
    if (btn) {
      btn.addEventListener('click', function () {
        var ev = deferred;
        deferred = null;
        ev.prompt();
        ev.userChoice.then(function (r) {
          if (!sheet) return;
          render(r && r.outcome === 'accepted' ? 'done' : undefined);
        });
      });
    }
  }

  // Chrome の準備（beforeinstallprompt）は少し遅れて来ることがあるので、少し待ってから手順に切り替える
  render(standalone || ios ? undefined : 'wait');
  if (!standalone && !ios) setTimeout(function () { if (sheet && !deferred) render(); }, 2500);
})();
