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
const CACHE = 'my-apps-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './portal.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
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
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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

  // 自分のオリジンのファイルだけを扱う。GAS への問い合わせには手を出さない。
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
