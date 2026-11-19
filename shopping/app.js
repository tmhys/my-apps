'use strict';
/* 買い物メモ（my-apps の shopping モジュール）

   gas/household-ordering（家庭内発注システム）をバックエンドにした薄いクライアント。
   LINE からの取り込み・Gemini での構造化・二重発注の判定・相場調べはすべて gas 側にあり、
   このモジュールは一覧の表示とボタンの送信だけを行う。

   画面の作りは gas の発注リスト画面（WebApp.gs）に合わせてある。タブも、カードに出す
   項目も、タブごとのボタンも同じ。**どちらで操作しても同じことが起きる**ようにするため、
   勝手な操作を足さない。

   - 接続先（URLと合言葉）は localStorage に保存する。キーは 'shopping:' 始まり。
     同じオリジンに他のアプリが同居しているので、接頭辞で分けておく。
   - 取得した内容も localStorage に残し、次回起動時はまずそれを描いてから取り直す。
     圏外でも「何を頼まれていたか」は見られるようにするため。

   ■このモジュール側で足したもの（gas の画面には無い）
   - 見送りリスト: 「見送り」にした商品は gas 側で「見送り」状態になり、どのレーン
     にも出てこなくなる。そのままでは後から見返せないので、見送った控えをこの
     端末の localStorage（'shopping:dismissed'）に残し、専用タブで見られるように
     した。「発注待ちに戻す」は gas の遷移（見送り→確認済）が許可されているので、
     既存の confirm 操作でサーバー側にも反映される。「完全に削除」はこの端末の
     控えを消す操作（シート側の「見送り」記録自体は残る）。
   - Amazon / 楽天のリンクバッジ: 検索リンクは全商品に常時付くため、商品ページ
     への直接リンク（送られたリンク・前回と同じ・最安の商品）があるかどうかを
     バッジで区別して出す。

   ■定期便は別ページ
   定期便は買い物依頼の流れから切り離した（gas の Subscriptions.gs の冒頭）。
   依頼のカードには定期便を出さず、ヘッダーの「定期便」から開く別の画面で、
   メールから作った一覧（payload.subscriptions）を見せるだけにしている。 */

const STORE_PREFIX = 'shopping:';

const TABS = [
  { key: 'waiting', label: '発注待ち' },
  { key: 'unconfirmed', label: '未確認' },
  { key: 'wishlist', label: '欲しいもの' },
  { key: 'ordered', label: '発注済' },
  { key: 'dismissed', label: '見送り' },
];

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

function read_(key) {
  try {
    return localStorage.getItem(STORE_PREFIX + key) || '';
  } catch (e) {
    return '';
  }
}

function write_(key, value) {
  try {
    localStorage.setItem(STORE_PREFIX + key, value);
  } catch (e) {
    /* プライベートモードなどで書けないことがある。設定が残らないだけで動く */
  }
}

function getSettings() {
  return { baseUrl: read_('baseUrl'), token: read_('token') };
}

function configured() {
  const s = getSettings();
  return Boolean(s.baseUrl && s.token);
}

function loadCache() {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + 'cache');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveCache(payload) {
  try {
    localStorage.setItem(STORE_PREFIX + 'cache', JSON.stringify(payload));
  } catch (e) {
    /* 容量超過などは無視する。次回は取りに行くだけ */
  }
}

// ---------------------------------------------------------------------------
// 見送りリスト（この端末に残す控え）
// ---------------------------------------------------------------------------

function loadDismissed() {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + 'dismissed');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((d) => d && d.id) : [];
  } catch (e) {
    return [];
  }
}

function saveDismissed(list) {
  try {
    localStorage.setItem(STORE_PREFIX + 'dismissed', JSON.stringify(list));
  } catch (e) {
    /* 書けない環境では控えが残らないだけ */
  }
}

/** 見送った商品の控えを残す。カードの描画に使う項目だけを写す。 */
function rememberDismissed(row) {
  if (!row || !row.id) return;
  const snap = {
    id: row.id,
    item: row.item,
    quantity: row.quantity,
    unit: row.unit,
    kind: row.kind,
    brandHint: row.brandHint,
    note: row.note,
    rawText: row.rawText,
    speaker: row.speaker,
    receivedAt: row.receivedAt,
    lastBought: row.lastBought,
    links: row.links || [],
    lowestUrl: row.lowestUrl || '',
    dismissedAt: new Date().toLocaleString('ja-JP'),
  };
  const list = loadDismissed().filter((d) => d.id !== row.id);
  list.unshift(snap);
  saveDismissed(list);
}

function forgetDismissed(id) {
  saveDismissed(loadDismissed().filter((d) => d.id !== id));
}

/**
 * サーバーの一覧のうちレーン（配列）だけ。list には today（文字列）なども入っているので、
 * キーを総なめにすると文字列に forEach して落ちる。
 */
function lanes() {
  const list = (payload && payload.list) || {};
  return Object.keys(list).map((k) => list[k]).filter(Array.isArray);
}

/** いまサーバー側のどこかのレーンに居る id 集合。 */
function laneIds() {
  const ids = {};
  lanes().forEach((rows) => {
    rows.forEach((r) => { ids[r.id] = true; });
  });
  return ids;
}

/**
 * 表示用の見送りリスト。どこかのレーンに戻っているもの（他の画面で
 * 戻された等）は控えから落とす。控えが嘘にならないようにするため。
 */
function currentDismissed() {
  const ids = laneIds();
  const list = loadDismissed();
  const kept = list.filter((d) => !ids[d.id]);
  if (kept.length !== list.length) saveDismissed(kept);
  return kept;
}

/** 現在の一覧から id で1件引く。 */
function findRow(id) {
  const all = lanes();
  for (let i = 0; i < all.length; i++) {
    const hit = all[i].find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function apiGet(override) {
  const s = Object.assign(getSettings(), override || {});
  if (!s.baseUrl || !s.token) throw new Error('設定画面でWebApp URLとトークンを入力してください');

  let url;
  try {
    url = new URL(s.baseUrl);
  } catch (e) {
    throw new Error('WebApp URLが正しいURLの形式ではありません');
  }
  url.searchParams.set('token', s.token);
  url.searchParams.set('format', 'json');

  let res;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new Error('通信できませんでした（URLかネットワークを確認してください）');
  }
  if (!res.ok) throw new Error('サーバーエラー: HTTP ' + res.status);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('サーバーの応答がJSONではありません（URLが /exec で終わっているか確認してください）');
  }
  if (data && data.error) throw new Error(data.error);
  if (!data || !data.list) {
    throw new Error('gas側（household-ordering）が古いようです。最新のコードを push して再デプロイしてください');
  }
  return data;
}

/**
 * ボタンの送信。
 *
 * POST の宛先には api=app を付ける。これが無いと gas 側は LINE の webhook として
 * 扱い、別の合言葉で弾かれる（household-ordering の Code.gs の doPost）。
 * Content-Type を text/plain にするのは CORS のプリフライトを避けるため。
 */
async function apiPost(payload) {
  const s = getSettings();
  if (!s.baseUrl || !s.token) throw new Error('設定画面でWebApp URLとトークンを入力してください');

  let url;
  try {
    url = new URL(s.baseUrl);
  } catch (e) {
    throw new Error('WebApp URLが正しいURLの形式ではありません');
  }
  url.searchParams.set('api', 'app');

  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ token: s.token }, payload)),
    });
  } catch (e) {
    throw new Error('通信できませんでした（URLかネットワークを確認してください）');
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('サーバーの応答がJSONではありません');
  }
  if (data && data.error) throw new Error(data.error);
  if (data && data.ok === false) throw new Error(data.message || '処理に失敗しました');
  return data;
}

// ---------------------------------------------------------------------------
// ボタンの定義（gas の発注リスト画面と同じ）
// ---------------------------------------------------------------------------

function baseActions(tab) {
  if (tab === 'waiting') {
    return [['order', '発注した', 'go'], ['hold', 'あとで', ''], ['reject', '見送り', '']];
  }
  if (tab === 'unconfirmed') {
    return [['confirm', '発注待ちへ', 'go'], ['hold', 'あとで', ''], ['reject', '見送り', '']];
  }
  if (tab === 'wishlist') {
    // 「必需品として登録／消耗品として登録／今回だけ買う」は使い分けが難しいので「買う」1つにした。
    // 中身は今回だけ買う（発注待ちへ。品目マスタには登録しない）と同じ。gas の画面と揃えてある。
    return [['confirm', '買う', 'go'], ['price', '相場を調べる', ''], ['reject', '見送り', '']];
  }
  return [['done', '届いた', 'go'], ['confirm', '発注待ちに戻す', '']];
}

/** 重複の疑い・名前が仮、は通常のボタンより先に出す。 */
function actionsFor(tab, r) {
  if (r && r.dupLabel) return [['merge', '同じ（まとめる）', 'go'], ['separate', '別のもの', '']];
  if (r && r.needsName) return [['rename', '名前をつける', 'go']].concat(baseActions(tab));
  return baseActions(tab);
}

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

function el(id) {
  return document.getElementById(id);
}

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function yen(n) {
  return '¥' + Number(n || 0).toLocaleString('ja-JP');
}

function show(kind, text) {
  const box = el('msg');
  box.className = 'msg ' + kind;
  box.textContent = text;
  box.hidden = false;
  window.scrollTo(0, 0);
}

function clearMsg() {
  el('msg').hidden = true;
}

/**
 * ボタンの結果は画面の下に一瞬だけ出す。上の #msg に出すと、出すたびに
 * 先頭へスクロールすることになり、続けて押していると表示がずれる。
 */
let toastTimer = null;
function toast(kind, text) {
  const box = el('toast');
  box.className = 'toast ' + kind;
  box.textContent = text;
  box.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { box.hidden = true; }, kind === 'ng' ? 6000 : 2500);
}

let payload = null;
let tab = 'waiting';

/**
 * URLのホストから店を判定する。判定できなければ ''。
 * 共有ボタンから送られるのはたいてい短縮URL（amzn.asia / amzn.to / a.co、楽天は r10.to）
 * なので、それも店のリンクとして数える。
 */
function shopOf(url) {
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)amazon\.(co\.jp|com)$/.test(host) || /^(amzn\.asia|amzn\.to|a\.co)$/.test(host)) {
      return 'amazon';
    }
    if (/(^|\.)rakuten\.co\.jp$/.test(host) || host === 'r10.to') return 'rakuten';
  } catch (e) {
    /* URLでない値は店なしとして扱う */
  }
  return '';
}

/**
 * Amazon / 楽天のリンクの有無をバッジで出す。
 *
 * gas 側は検索リンク（ラベルが 'Amazon' / '楽天'）を全商品に常時付けるので、
 * 「リンクがある」だけでは意味が無い。ここで分けるのは商品ページへの直接
 * リンク（送られたリンク・前回と同じ・最安の商品のURL）があるかどうか。
 *   直接リンクあり → 「商品リンクあり」（緑）
 *   検索リンクだけ → 「検索のみ」
 *   どちらも無い   → 「リンクなし」（薄く破線）
 * 発注済タブは従来どおりリンクを出さない画面なので、バッジも飛べない表示だけにする。
 */
function shopBadgesHtml(r) {
  const direct = {};
  const search = {};
  (r.links || []).forEach((l) => {
    if (l.label === 'Amazon') search.amazon = l.url;
    else if (l.label === '楽天') search.rakuten = l.url;
    else {
      const shop = shopOf(l.url);
      if (shop && !direct[shop]) direct[shop] = l.url;
    }
  });
  const lowShop = shopOf(r.lowestUrl);
  if (lowShop && !direct[lowShop]) direct[lowShop] = r.lowestUrl;

  const clickable = tab !== 'ordered';
  const h = ['<div class="shops">'];
  [['amazon', 'Amazon'], ['rakuten', '楽天']].forEach((s) => {
    const key = s[0];
    const name = s[1];
    if (direct[key]) {
      h.push(clickable
        ? '<a class="shop has" target="_blank" rel="noopener" href="' + esc(direct[key]) + '">' + name + ' 商品リンクあり</a>'
        : '<span class="shop has">' + name + ' 商品リンクあり</span>');
    } else if (search[key]) {
      h.push(clickable
        ? '<a class="shop search" target="_blank" rel="noopener" href="' + esc(search[key]) + '">' + name + ' 検索のみ</a>'
        : '<span class="shop search">' + name + ' 検索のみ</span>');
    } else {
      h.push('<span class="shop none">' + name + ' リンクなし</span>');
    }
  });
  h.push('</div>');
  return h.join('');
}

function cardHtml(r) {
  const warn = r.duplicateWarn || r.overdue;
  const h = ['<div class="card' + (warn ? ' warn' : '') + '" data-id="' + esc(r.id) + '">'];

  h.push('<div class="name">' + esc(r.item) +
    (r.quantity ? ' ×' + esc(r.quantity) + esc(r.unit || '') : '') + '</div>');

  const badges = [];
  if (r.duplicateWarn) badges.push('<span class="badge ng">最近も発注済み</span>');
  if (r.needsReview) badges.push('<span class="badge ng">要確認</span>');
  if (r.deadline) badges.push('<span class="badge">期限 ' + esc(r.deadline) + '</span>');
  if (r.kind) badges.push('<span class="badge">' + esc(r.kind) + '</span>');
  if (badges.length) h.push('<div class="badges">' + badges.join('') + '</div>');

  const meta = [];
  if (r.brandHint) meta.push('指定: ' + esc(r.brandHint));
  if (r.lastBought) meta.push(esc(r.lastBought));
  if (r.stockSignal) meta.push('在庫: ' + esc(r.stockSignal));
  if (r.note) meta.push(esc(r.note));
  meta.push(esc(r.speaker) + ' ' + esc(r.receivedAt));
  if (tab === 'dismissed' && r.dismissedAt) meta.push('見送り: ' + esc(r.dismissedAt));
  h.push('<div class="meta">' + meta.join('<br>') + '</div>');

  h.push(shopBadgesHtml(r));

  if (r.rawText) h.push('<div class="raw">' + esc(r.rawText) + '</div>');
  if (r.dupLabel) h.push('<div class="sub warn">' + esc(r.dupLabel) + '</div>');

  // 発注済: 発注した日・届く予定・注文番号。妻が「頼んだか・いつ届くか」をここで見る。
  if (tab === 'ordered') {
    const o = [];
    if (r.orderedLabel) o.push(esc(r.orderedLabel));
    if (r.arrivalLabel) o.push('<b>' + esc(r.arrivalLabel) + '</b>');
    if (r.orderNo) o.push('注文番号 ' + esc(r.orderNo));
    if (o.length) h.push('<div class="sub on">' + o.join('<br>') + '</div>');
  }

  if (r.market) {
    h.push('<div class="price">');
    if (r.lowest) h.push('<span class="lo">最安 ' + yen(r.lowest) + '</span><br>');
    h.push(esc(r.priceLine));
    if (r.pricedAt) h.push('<br><span class="at">' + esc(r.pricedAt) + '</span>');
    h.push('</div>');
  }

  if (tab !== 'ordered') {
    const links = [];
    if (r.lowestUrl) {
      links.push('<a target="_blank" rel="noopener" href="' + esc(r.lowestUrl) + '">最安の商品</a>');
    }
    (r.links || []).forEach((l) => {
      // Amazon / 楽天の検索リンクはバッジ側で出すので、ここでは繰り返さない。
      if (l.label === 'Amazon' || l.label === '楽天') return;
      links.push('<a target="_blank" rel="noopener" href="' + esc(l.url) + '">' + esc(l.label) + '</a>');
    });
    if (links.length) h.push('<div class="links">' + links.join('') + '</div>');
  }

  h.push('<div class="acts">');
  const acts = tab === 'dismissed'
    ? [['restore', '発注待ちに戻す', 'go'], ['purge', '完全に削除', '']]
    : actionsFor(tab, r);
  acts.forEach((a) => {
    h.push('<button class="' + a[2] + '" data-act="' + esc(a[0]) + '">' + esc(a[1]) + '</button>');
  });
  h.push('</div></div>');

  return h.join('');
}

function render() {
  const list = (payload && payload.list) || {};
  const dismissed = currentDismissed();

  TABS.forEach((t) => {
    const btn = el('tabs').querySelector('[data-tab="' + t.key + '"]');
    if (!btn) return;
    btn.className = t.key === tab ? 'on' : '';
    const rows = t.key === 'dismissed' ? dismissed : (list[t.key] || []);
    btn.querySelector('.n').textContent = rows.length ? rows.length : '';
  });

  const rows = tab === 'dismissed' ? dismissed : (list[tab] || []);
  el('list').innerHTML = rows.length
    ? rows.map(cardHtml).join('')
    : '<div class="empty">ここは空です</div>';

  el('foot').textContent = tab === 'dismissed'
    ? 'この端末で見送った控えです。「発注待ちに戻す」はサーバーにも反映されます'
    : (payload && payload.updatedAt ? payload.updatedAt + ' 時点' : '');
}

// ---------------------------------------------------------------------------
// 定期便（見るだけの別ページ）
// ---------------------------------------------------------------------------

function renderSubscriptions() {
  const subs = payload && payload.subscriptions;
  if (!Array.isArray(subs)) {
    el('subs-list').innerHTML = '<div class="empty">gas 側が古いようです。最新のコードを push して再デプロイしてください</div>';
    return;
  }
  el('subs-list').innerHTML = subs.length
    ? subs.map((r) => {
      const meta = [r.quantity > 1 ? '×' + r.quantity : '', r.cycleLabel, r.mailDate ? 'メール ' + r.mailDate.slice(5).replace('-', '/') : '']
        .filter((v) => v).map(esc).join(' / ');
      return '<div class="card sub-card ' + esc(r.status) + '">' +
        '<div class="name">' + esc(r.name) + '</div>' +
        '<div class="when">' + esc(r.label) + '</div>' +
        (r.note ? '<div class="meta">' + esc(r.note) + '</div>' : '') +
        (meta ? '<div class="meta">' + meta + '</div>' : '') +
        '</div>';
    }).join('')
    : '<div class="empty">まだメールを読んでいません（毎朝5時に更新）</div>';
}

// ---------------------------------------------------------------------------
// 続けて押しても表示がずれないように
//
// 押すたびに一覧を取り直して描き直すと、取り直しの最中に次のカードを押したとき
// カードが入れ替わって位置がずれる。押した行は手元ですぐ消し、取り直しは
// 最後に押してから少し待って1回だけにする。押している途中は描き直さない。
// ---------------------------------------------------------------------------

let busy = 0;
let refreshTimer = null;

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    if (busy) {
      scheduleRefresh();
      return;
    }
    load({ quiet: true });
  }, 1500);
}

/** 押した操作で行がいまのタブから外れるか。gas の orderListAction と揃える。 */
const LEAVES_TAB = ['order', 'confirm', 'hold', 'reject', 'done', 'register', 'merge'];

/** 手元の一覧を先に直す。サーバーの答えは取り直しで上書きされる。 */
function applyLocally(id, action, body) {
  if (!payload || !payload.list) return;
  const rows = payload.list[tab];
  if (!Array.isArray(rows)) return;
  if (LEAVES_TAB.indexOf(action) !== -1) {
    payload.list[tab] = rows.filter((r) => r.id !== id);
    return;
  }
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  if (action === 'rename') { row.item = body.name; row.needsName = false; }
  if (action === 'separate') row.dupLabel = '';
}

// ---------------------------------------------------------------------------
// 読み込みと操作
// ---------------------------------------------------------------------------

async function load(options) {
  const opts = options || {};

  if (!configured()) {
    openSettings();
    show('ng', 'まず接続先を設定してください。');
    return;
  }

  if (!payload) {
    const cached = loadCache();
    if (cached) {
      payload = cached;
      render();
      renderSubscriptions();
    } else {
      el('list').innerHTML = '<div class="empty">読み込み中…</div>';
    }
  }

  try {
    const fresh = await apiGet();
    if (busy) {
      // 取りに行っている間に別のボタンが押された。古い答えで描き直さず、あとで取り直す。
      scheduleRefresh();
      return;
    }
    payload = fresh;
    saveCache(payload);
    render();
    renderSubscriptions();
    if (!opts.quiet) clearMsg();
  } catch (e) {
    if (payload) {
      show('ng', e.message + '（前回取得した内容を表示しています）');
    } else {
      el('list').innerHTML = '<div class="empty">—</div>';
      show('ng', e.message);
    }
  }
}

async function runAction(id, act, button) {
  const card = button.closest('.card');
  const buttons = card.querySelectorAll('button');
  buttons.forEach((b) => { b.disabled = true; });

  // 見送りリストの中の操作。サーバーへ行くのは「戻す」だけ。
  if (tab === 'dismissed') {
    if (act === 'purge') {
      if (!window.confirm('見送りリストから完全に削除しますか？')) {
        buttons.forEach((b) => { b.disabled = false; });
        return;
      }
      forgetDismissed(id);
      render();
      toast('ok', '見送りリストから削除しました');
      return;
    }
    if (act === 'restore') {
      busy++;
      try {
        // gas の遷移表で「見送り → 確認済（発注待ち）」が許可されている。
        const res = await apiPost({ action: 'confirm', id: id });
        forgetDismissed(id);
        render();
        toast('ok', res.message || '発注待ちに戻しました');
        scheduleRefresh();
      } catch (e) {
        toast('ng', e.message);
        buttons.forEach((b) => { b.disabled = false; });
      } finally {
        busy--;
      }
      return;
    }
    buttons.forEach((b) => { b.disabled = false; });
    return;
  }

  // 'register:必需品' のように区分を後ろに付けている。gas 側は action と kind で受ける。
  const parts = act.split(':');
  const body = { action: parts[0], id: id };
  if (parts[1]) body.kind = parts[1];

  if (parts[0] === 'order') {
    // どちらも任意。必須にすると面倒でボタン自体が押されなくなる（gas の画面と同じ）。
    // 到着予定日の表記（11/21 など）は gas 側で読み、読めなければ断ってくる。
    const no = window.prompt('注文番号（空でもOK。Amazonの注文確定画面・メールに出ています）', '');
    if (no === null) {
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }
    const arrival = window.prompt('到着予定日（空でもOK。例: 11/21）', '');
    if (arrival === null) {
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }
    body.orderNo = no.trim();
    body.arrivalExpected = arrival.trim();
  }

  if (parts[0] === 'rename') {
    const name = window.prompt('品目名を入れてください');
    if (!name || !name.trim()) {
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }
    body.name = name.trim();
  }

  busy++;
  try {
    const res = await apiPost(body);
    // 見送った控えは、手元の一覧から消す前に写しておく。
    if (parts[0] === 'reject') rememberDismissed(findRow(id));
    applyLocally(id, parts[0], body);
    render();
    toast('ok', res.message || '更新しました');
    // 相場調べなどはレーンが動かないが、結果を出すために取り直す。
    scheduleRefresh();
  } catch (e) {
    toast('ng', e.message);
    buttons.forEach((b) => { b.disabled = false; });
  } finally {
    busy--;
  }
}

// ---------------------------------------------------------------------------
// 画面の切り替え
// ---------------------------------------------------------------------------

function showView(id) {
  ['view-home', 'view-settings', 'view-subs'].forEach((v) => {
    el(v).classList.toggle('active', v === id);
  });
  window.scrollTo(0, 0);
}

function openSettings() {
  const s = getSettings();
  el('set-url').value = s.baseUrl;
  el('set-token').value = s.token;
  el('set-msg').hidden = true;
  showView('view-settings');
}

function closeSettings() {
  showView('view-home');
}

function openSubscriptions() {
  renderSubscriptions();
  showView('view-subs');
}

function setMsg(kind, text) {
  const box = el('set-msg');
  box.className = 'msg ' + kind;
  box.textContent = text;
  box.hidden = false;
}

// ---------------------------------------------------------------------------
// 起動
// ---------------------------------------------------------------------------

el('tabs').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-tab]');
  if (!btn) return;
  tab = btn.getAttribute('data-tab');
  render();
});

el('list').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const card = btn.closest('.card');
  runAction(card.getAttribute('data-id'), btn.getAttribute('data-act'), btn);
});

el('refresh').onclick = () => load();
el('open-settings').onclick = openSettings;
el('open-subs').onclick = openSubscriptions;
el('close-subs').onclick = () => showView('view-home');
el('close-settings').onclick = () => {
  closeSettings();
  if (configured()) load();
};

el('test-conn').onclick = async () => {
  const baseUrl = el('set-url').value.trim();
  const token = el('set-token').value.trim();
  if (!baseUrl || !token) {
    setMsg('ng', 'URLとトークンの両方を入れてください。');
    return;
  }
  setMsg('ok', '確認中…');
  try {
    const data = await apiGet({ baseUrl: baseUrl, token: token });
    const n = (data.list.waiting || []).length;
    const w = (data.list.wishlist || []).length;
    setMsg('ok', `繋がりました。発注待ち ${n} 件 / 欲しいもの ${w} 件。`);
  } catch (e) {
    setMsg('ng', e.message);
  }
};

el('save-settings').onclick = () => {
  write_('baseUrl', el('set-url').value.trim());
  write_('token', el('set-token').value.trim());
  setMsg('ok', '保存しました。');
  closeSettings();
  payload = null;
  load();
};

// 見送りリストの書き出し／読み込み。このモジュールが端末に持つのは
// 接続設定と取得キャッシュと見送りの控えだけで、書き出すのは控えのみ
// （接続設定には合言葉が含まれるので書き出しには含めない）。
el('export-dismissed').onclick = () => {
  const data = {
    type: 'my-apps-shopping',
    version: 1,
    exportedAt: new Date().toISOString(),
    dismissed: loadDismissed(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shopping-dismissed.json';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setMsg('ok', '見送りリストを書き出しました（' + data.dismissed.length + '件）。');
};

el('import-dismissed').onclick = () => el('import-file').click();

el('import-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data.dismissed;
    if (!Array.isArray(arr)) throw new Error('見送りリストの形式ではありません');
    // 自分で書き出したファイルでも、リンクは http(s) だけ通す（javascript: などを入れない）。
    const web = (u) => /^https?:\/\//i.test(String(u || ''));
    const valid = arr.filter((d) => d && d.id && d.item).map((d) => Object.assign({}, d, {
      links: (Array.isArray(d.links) ? d.links : []).filter((l) => l && web(l.url)),
      lowestUrl: web(d.lowestUrl) ? d.lowestUrl : '',
    }));
    const byId = {};
    loadDismissed().forEach((d) => { byId[d.id] = d; });
    valid.forEach((d) => { byId[d.id] = d; });
    saveDismissed(Object.keys(byId).map((k) => byId[k]));
    render();
    setMsg('ok', '見送りリストを読み込みました（' + valid.length + '件）。');
  } catch (e) {
    setMsg('ng', '読み込めませんでした: ' + e.message);
  }
});

load();
