/**
 * アプリシェル（HTML/CSS/JS/アイコン）だけを扱う Service Worker。
 *
 * ■なぜキャッシュ優先をやめたか
 *   以前はここでキャッシュ優先に返していたため、更新を公開しても端末に届かな
 *   かった（kakeibo-pwa が同じ理由で Service Worker を撤去している）。
 *   ネットワーク優先にして、取れたものを控えに回し、圏外のときだけ控えを出す。
 *   オフラインで起動できる利点は残したまま、古い版が焼き付くのを防ぐ。
 *
 * ■なぜ別オリジンを素通しするか
 *   立替精算モジュールは Google Apps Script に ?month=... を付けて問い合わせる。
 *   以前の実装は fetch したものを何でも控えに入れ、照合は ignoreSearch: true
 *   だったので、クエリ違いの応答を取り違える（先月の金額が出る）恐れがあった。
 *   自分のオリジン以外は触らない。
 */
/* ■なぜ no-cache で取りに行くか
 *   GitHub Pages はファイルを10分ほどブラウザに覚えさせる（max-age=600）。素の fetch だと
 *   その控えが返り、HTML だけ新しく JS が古い、という組み合わせになって画面が壊れた
 *   （隙間トレのカードが空になった）。no-cache は毎回サーバーに「変わったか」を聞くだけで、
 *   変わっていなければ中身は送られない（304）ので通信量はほぼ増えない。
 */
const CACHE = 'my-apps-v36';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './portal.js',
  './launcher.js',
  './install.js',
  './nav.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/workout-192.png',
  './icons/reimburse-192.png',
  './icons/shopping-192.png',
  './icons/gijutsushi-192.png',
  './reimburse/manifest.webmanifest',
  './shopping/manifest.webmanifest',
  './gijutsushi/manifest.webmanifest',
  './workout/',
  './workout/index.html',
  './workout/styles.css',
  './workout/app.js',
  './reimburse/',
  './reimburse/index.html',
  './reimburse/styles.css',
  './reimburse/app.js',
  './shopping/',
  './shopping/index.html',
  './shopping/styles.css',
  './shopping/app.js',
  './gijutsushi/',
  './gijutsushi/index.html',
  './gijutsushi/hub.css',
  './gijutsushi/habit.js',
  './gijutsushi/backup.js',
  './gijutsushi/abbr.js',
  './gijutsushi/ronbun/',
  './gijutsushi/ronbun/index.html',
  './gijutsushi/ronbun/styles.css',
  './gijutsushi/ronbun/app.js',
  './gijutsushi/ronbun/data.js',
  './gijutsushi/ronbun/ii1-answers.js',
  './gijutsushi/pakuringo/',
  './gijutsushi/pakuringo/index.html',
  './gijutsushi/pakuringo/styles.css',
  './gijutsushi/pakuringo/app.js',
  './gijutsushi/pakuringo/data.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // 自分のスコープ（/my-apps/）のファイルだけを扱う。GAS への問い合わせには手を出さない。
  // 同じ tmhys.github.io でも他のリポジトリ（habit-pwa の habits.json 等）は素通しする。
  if (!e.request.url.startsWith(self.registration.scope)) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
