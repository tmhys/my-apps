'use strict';
/* 立替精算（my-apps の reimburse モジュール）

   gas/receipt-reimbursement のウェブアプリをバックエンドにした薄いクライアント。
   未精算の集計・重複判定・精算済みの書き込みはすべて gas 側にあり、
   このモジュールは表示と、明細1件の操作（メモ・精算対象の切り替え）の送信だけを行う。

   明細は行をタップすると開く。開いた中でできるのは次の3つ。
   - メモを書く（自分で確かめたあとの覚え書き。シートの「メモ」列）
   - 精算対象から外す／戻す（シートの「精算対象」列。精算額は gas 側の数式が追従する）
   - レシートの画像を開く（Drive のファイル）
   直したら読み込み直す。送金額やカテゴリ別も一緒に変わるため、
   手元で足し引きして辻褄を合わせない。

   - 接続先（URLと合言葉）は localStorage に保存する。キーは 'reimburse:' 始まり。
     同じオリジン（tmhys.github.io）に habit-pwa / kakeibo-pwa / workout が同居して
     いるので、接頭辞で分けておかないと取り違える。
   - 取得した内容も localStorage に残し、次回起動時はまずそれを描いてから取り直す。
     圏外でも前回の金額が出るようにするため（Service Worker には頼らない）。 */

const STORE_PREFIX = 'reimburse:';

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
    /* プライベートモードなどで書けないことがある。設定が保存されないだけで動く */
  }
}

function getSettings() {
  return { baseUrl: read_('baseUrl'), token: read_('token') };
}

function configured() {
  const s = getSettings();
  return Boolean(s.baseUrl && s.token);
}

// ---------------------------------------------------------------------------
// 直前の内容（圏外でも何か出すため）
// ---------------------------------------------------------------------------

function loadCache(month) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + 'cache');
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached && cached.month === month ? cached.model : null;
  } catch (e) {
    return null;
  }
}

function saveCache(month, model) {
  try {
    localStorage.setItem(STORE_PREFIX + 'cache', JSON.stringify({ month: month, model: model }));
  } catch (e) {
    /* 容量超過などは無視する。次回は取りに行くだけ */
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function apiGet(month, override) {
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
  if (month) url.searchParams.set('month', month);

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
  if (!data || typeof data.payable !== 'number') {
    throw new Error('gas側（receipt-reimbursement）が古いようです。最新のコードを貼って「新バージョン」で再デプロイしてください');
  }
  return data;
}

async function apiSettle(month) {
  const s = getSettings();
  if (!s.baseUrl || !s.token) throw new Error('設定画面でWebApp URLとトークンを入力してください');

  let res;
  try {
    // text/plain にすることで CORS のプリフライト(OPTIONS)を起こさない。
    // gas 側は e.postData.contents を JSON として読む。
    res = await fetch(s.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'settle', token: s.token, month: month }),
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
  return data;
}

/**
 * 明細1件を直す。patch は {note} か {target} か両方。
 *
 * expect には画面に出ていた購入日と金額を入れて送る。gas 側はそれが
 * シートの行と一致したときだけ書き込む。シートを手で並べ替えた後などに
 * 行番号だけで書くと、関係ない行を壊すため。
 */
async function apiUpdate(item, patch) {
  const s = getSettings();
  if (!s.baseUrl || !s.token) throw new Error('設定画面でWebApp URLとトークンを入力してください');

  const body = Object.assign(
    { action: 'update', token: s.token, row: item.row,
      expect: { date: item.date, amount: item.amount } },
    patch
  );

  let res;
  try {
    res = await fetch(s.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
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
  const stale = 'gas側（receipt-reimbursement）が古いようです。最新のコードを push して再デプロイしてください';
  if (data && data.error) {
    // 再デプロイ前の gas は update を知らない。そのままの文面だと原因が分からない。
    throw new Error(/知らない action/.test(data.error) ? stale : data.error);
  }
  if (!data || data.ok !== true) throw new Error(stale);
  return data;
}

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

function yen(amount) {
  const n = Math.round(Number(amount) || 0);
  return n.toLocaleString('ja-JP') + ' 円';
}

function shortDate(ymd) {
  const m = String(ymd || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? Number(m[1]) + '/' + Number(m[2]) : String(ymd || '');
}

function barPct(value, max) {
  if (!max || max <= 0) return 0;
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  return Math.max(1, Math.round((v / max) * 100));
}

function el(id) {
  return document.getElementById(id);
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

/** 画面に出ている月。設定が無い初回は空。 */
let viewMonth = '';
/** 直前に描いた内容。精算ボタンの件数に使う。 */
let current = null;
/** 精算ボタンが確認待ちかどうか。 */
let armed = false;

/** 行番号 -> 明細。開いた行の中身を引くため。 */
let byRow = {};
/** いま開いている行番号。0なら閉じている。 */
let openRow = 0;

function itemsTable(items, hiddenCount) {
  const rows = items.map((it) =>
    '<tr class="item" data-row="' + it.row + '">' +
      '<td class="d">' + escapeHtml(shortDate(it.date) || '日付なし') + '</td>' +
      '<td>' + escapeHtml(it.store) +
        (it.carried ? '<span class="tag">繰越</span>' : '') +
        (it.needsReview ? '<span class="tag rv">要確認</span>' : '') +
        (it.note ? '<span class="tag">メモ</span>' : '') +
        '<div class="sub">' + escapeHtml(it.category) + '</div></td>' +
      '<td class="a">' + (it.target ? yen(it.settle) : '<span class="off">対象外</span>') + '</td>' +
    '</tr>' +
    '<tr class="detail" data-detail="' + it.row + '" hidden><td colspan="3"></td></tr>'
  ).join('');
  const more = hiddenCount
    ? '<p class="cap" style="margin-top:10px">ほか ' + hiddenCount + ' 件（シートで見られます）</p>'
    : '';
  return '<table>' + rows + '</table>' + more;
}

/** 開いた行の中身。メモ・精算対象・レシート。 */
function detailHtml(it) {
  const h = [];
  h.push('<div class="detail-box">');
  h.push('<div class="sub">' + escapeHtml(it.row + '行目 · ' + it.store + ' · ' + yen(it.amount)) + '</div>');

  h.push('<label class="dl" for="note-' + it.row + '">メモ</label>');
  h.push('<textarea id="note-' + it.row + '" class="note" rows="2" ' +
    'placeholder="確かめた内容など">' + escapeHtml(it.note || '') + '</textarea>');

  h.push('<div class="detail-acts">');
  h.push('<button type="button" class="secondary" data-act="save-note">メモを保存</button>');
  h.push('<button type="button" class="secondary' + (it.target ? '' : ' back') + '" data-act="toggle">' +
    (it.target ? '精算対象から外す' : '精算対象に戻す') + '</button>');
  h.push('</div>');

  if (it.fileUrl) {
    h.push('<a class="receipt" href="' + escapeHtml(it.fileUrl) + '" target="_blank" rel="noopener">レシートの画像を開く</a>');
  } else {
    h.push('<p class="cap">レシートの画像が見つかりません（手で足した行かもしれません）。</p>');
  }
  h.push('</div>');
  return h.join('');
}

function closeDetail() {
  openRow = 0;
  document.querySelectorAll('tr.detail').forEach((tr) => {
    tr.hidden = true;
    tr.firstChild.innerHTML = '';
  });
  document.querySelectorAll('tr.item.open').forEach((tr) => tr.classList.remove('open'));
}

function openDetail(row) {
  const it = byRow[row];
  const tr = document.querySelector('tr.detail[data-detail="' + row + '"]');
  if (!it || !tr) return;
  closeDetail();
  openRow = row;
  tr.hidden = false;
  tr.firstChild.innerHTML = detailHtml(it);
  const head = document.querySelector('tr.item[data-row="' + row + '"]');
  if (head) head.classList.add('open');
}

function render(m) {
  current = m;
  viewMonth = m.month || m.ym || viewMonth;

  el('cur-month').textContent = viewMonth;
  el('prev-month').disabled = false;
  el('next-month').disabled = !m.canGoNext;

  el('hero-cap').textContent = viewMonth + ' までの未精算 · 送金額';
  el('hero').textContent = yen(m.payable);

  // 内訳
  const parts = [
    '<span>' + viewMonth + ' 分 ' + yen(m.monthTotal) +
      '<span class="sub"> / ' + m.monthCount + ' 件</span></span>',
  ];
  if (m.carryCount) {
    parts.push('<span>繰り越し ' + yen(m.carryTotal) +
      '<span class="sub"> / ' + m.carryCount + ' 件</span></span>');
  }
  if (m.settledTotal) {
    parts.push('<span class="sub">精算済み ' + yen(m.settledTotal) + '（送金不要）</span>');
  }
  el('breakdown').innerHTML = parts.join('');

  // 要確認
  const reviews = m.reviewRows || [];
  el('review-card').hidden = reviews.length === 0;
  if (reviews.length) {
    el('review-title').textContent = '要確認 ' + reviews.length + ' 件';
    const note = el('review-note');
    if (m.undatedCount) {
      note.textContent = 'うち ' + m.undatedCount +
        ' 件は購入日が未確定で、この合計に含まれていません。';
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    el('review-list').innerHTML = reviews.map((r) => {
      const label = r.row + '行目: ' + r.store + ' ' + yen(r.amount);
      return '<li>' + escapeHtml(label + (r.note ? ' — ' + r.note : '')) + '</li>';
    }).join('');
  }

  // 精算ボタン
  const canSettle = m.payable > 0 || m.itemCount > 0;
  el('settle-card').hidden = !canSettle;
  if (canSettle) {
    el('settle-cap').textContent =
      '送金したら押す。' + viewMonth + ' までの未精算 ' + m.itemCount +
      ' 件に「精算済み」のチェックが入る。';
    resetSettleButton();
  }

  // カテゴリ別
  const cats = m.categories || [];
  el('category-card').hidden = cats.length === 0;
  el('categories').innerHTML = cats.map((c) =>
    '<div class="cat"><div class="cat-row">' +
      '<span>' + escapeHtml(c.name) + '</span>' +
      '<span class="cat-amt">' + yen(c.amount) + '</span>' +
    '</div><div class="track">' +
      '<div class="fill" style="width:' + barPct(c.amount, m.maxCategory) + '%"></div>' +
    '</div></div>'
  ).join('');

  // 明細
  byRow = {};
  (m.items || []).concat(m.excluded || []).forEach((it) => { byRow[it.row] = it; });

  const items = m.items || [];
  el('items').innerHTML = items.length
    ? itemsTable(items, m.hiddenCount)
    : '<p class="cap">この月までの未精算はありません。</p>';

  // 精算対象から外してある分。送金額には入らないが、ここから戻せる。
  const excluded = m.excluded || [];
  el('excluded-card').hidden = excluded.length === 0;
  if (excluded.length) {
    el('excluded-title').textContent = '精算対象外 ' + (m.excludedCount || excluded.length) + ' 件';
    el('excluded').innerHTML = itemsTable(excluded, m.excludedHidden);
  }

  // 開いていた行は開いたままにする（メモを直した直後に閉じると、
  // 反映されたのか分からなくなるため）。
  if (openRow && byRow[openRow]) openDetail(openRow);

  // フッタ
  const foot = [];
  if (m.spreadsheetUrl) {
    foot.push('<a href="' + escapeHtml(m.spreadsheetUrl) + '" target="_blank" rel="noopener">明細シートを開く</a>');
  }
  if (m.updatedAt) foot.push(escapeHtml(m.updatedAt) + ' 時点');
  el('foot').innerHTML = foot.join(' · ');
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resetSettleButton() {
  armed = false;
  const btn = el('settle');
  btn.className = 'primary';
  btn.disabled = false;
  btn.textContent = '精算済みにする';
}

// ---------------------------------------------------------------------------
// 読み込み
// ---------------------------------------------------------------------------

function thisMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
}

function monthAdd(month, n) {
  const p = String(month).split('-');
  const total = Number(p[0]) * 12 + (Number(p[1]) - 1) + n;
  return Math.floor(total / 12) + '-' + ('0' + ((total % 12) + 1)).slice(-2);
}

async function load(month, options) {
  const opts = options || {};
  const target = month || thisMonth();

  if (!configured()) {
    openSettings();
    show('ng', 'まず接続先を設定してください。');
    return;
  }

  // 圏外や読み込み中でも何か出す。取れたら上書きする。
  if (!opts.keepView) {
    const cached = loadCache(target);
    if (cached) render(cached);
    else el('hero').textContent = '読み込み中…';
    el('cur-month').textContent = target;
  }

  try {
    const data = await apiGet(target);
    viewMonth = target;
    saveCache(target, data);
    render(data);
    if (!opts.quiet) clearMsg();
  } catch (e) {
    const cached = loadCache(target);
    if (cached) {
      render(cached);
      show('ng', e.message + '（前回取得した内容を表示しています）');
    } else {
      el('hero').textContent = '—';
      show('ng', e.message);
    }
  }
}

// ---------------------------------------------------------------------------
// 画面の切り替え
// ---------------------------------------------------------------------------

function openSettings() {
  const s = getSettings();
  el('set-url').value = s.baseUrl;
  el('set-token').value = s.token;
  el('set-msg').hidden = true;
  el('view-home').classList.remove('active');
  el('view-settings').classList.add('active');
  window.scrollTo(0, 0);
}

function closeSettings() {
  el('view-settings').classList.remove('active');
  el('view-home').classList.add('active');
  window.scrollTo(0, 0);
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

el('prev-month').onclick = () => load(monthAdd(viewMonth || thisMonth(), -1));
el('next-month').onclick = () => {
  if (current && !current.canGoNext) return;
  load(monthAdd(viewMonth || thisMonth(), 1));
};

el('open-settings').onclick = openSettings;
el('close-settings').onclick = () => {
  closeSettings();
  if (configured()) load(viewMonth);
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
    const data = await apiGet(thisMonth(), { baseUrl: baseUrl, token: token });
    setMsg('ok', '繋がりました。未精算 ' + yen(data.payable) + '。');
  } catch (e) {
    setMsg('ng', e.message);
  }
};

el('save-settings').onclick = () => {
  write_('baseUrl', el('set-url').value.trim());
  write_('token', el('set-token').value.trim());
  setMsg('ok', '保存しました。');
  closeSettings();
  load(thisMonth());
};

el('settle').onclick = async () => {
  const btn = el('settle');
  const count = current ? current.itemCount : 0;

  // 1回目は確認に変えるだけ。ポケットの中の誤タップで精算済みにしない。
  if (!armed) {
    armed = true;
    btn.className = 'primary arm';
    btn.textContent = '本当に精算済みにする（' + count + '件）';
    setTimeout(() => {
      if (armed) resetSettleButton();
    }, 8000);
    return;
  }

  armed = false;
  btn.className = 'primary';
  btn.disabled = true;
  btn.textContent = '処理中…';

  try {
    const res = await apiSettle(viewMonth);
    show('ok', res.message || '精算済みにしました。');
    await load(viewMonth, { quiet: true, keepView: true });
  } catch (e) {
    show('ng', e.message);
    resetSettleButton();
  }
};

load(thisMonth());

/**
 * 明細のタップ。行を開く／閉じる、メモの保存、精算対象の切り替え。
 *
 * 行は描き直すたびに作り直されるので、個々の行に onclick は付けず、
 * 外側で受ける。開いた中のボタンも同じ経路で拾う。
 */
function wireItems(containerId) {
  el(containerId).addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (btn) {
      await runItemAction(btn);
      return;
    }
    // 開いた中のテキスト入力やリンクは、行の開閉に巻き込まない。
    if (ev.target.closest('tr.detail')) return;

    const head = ev.target.closest('tr.item');
    if (!head) return;
    const row = Number(head.dataset.row);
    if (row === openRow) closeDetail();
    else openDetail(row);
  });
}

async function runItemAction(btn) {
  const it = byRow[openRow];
  if (!it) return;

  const patch = {};
  if (btn.dataset.act === 'save-note') {
    const box = document.getElementById('note-' + it.row);
    patch.note = box ? box.value : '';
  } else if (btn.dataset.act === 'toggle') {
    patch.target = !it.target;
  } else {
    return;
  }

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '送信中…';
  try {
    const res = await apiUpdate(it, patch);
    show('ok', res.message || '更新しました。');
    // 送金額もカテゴリ別も変わる。手元で足し引きせず、取り直す。
    await load(viewMonth, { quiet: true, keepView: true });
  } catch (e) {
    show('ng', e.message);
    btn.disabled = false;
    btn.textContent = label;
  }
}

wireItems('items');
wireItems('excluded');
