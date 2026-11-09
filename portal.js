'use strict';
/* ポータルの小さな仕掛け。別アプリのカードで、静的な href だけでは足りないものを扱う。

   1. らくな家計簿 … Android アプリ（WebView）なので、Android では intent:// に
      差し替えて、ウェブ版ではなくアプリを起動する。
   2. Claude Inbox … URL を公開リポジトリに書きたくないので、端末の localStorage に
      置く。ワーカーのホスト名は設計上どこにも公開していない。

   習慣グリッドは tmhys.github.io 配下のウェブ版をそのまま開くので、ここでは触らない。 */

// ---------------------------------------------------------------------------
// らくな家計簿は Android アプリ（WebView）
// ---------------------------------------------------------------------------

(function () {
  // kakeibo-pwa の android/ は TWA ではなく素の WebView アプリで、
  // https を受け取る intent-filter が無い。そのため https のリンクでは
  // アプリが起動せず Chrome が開いてしまう。
  //
  // MAIN / LAUNCHER を指す intent:// でも起動しなかった。Chrome は intent://
  // を発射するとき BROWSABLE カテゴリを必ず足し、Android は付いた全カテゴリを
  // 宣言しているアクティビティしか起動しないため。アプリ側に
  // VIEW + DEFAULT + BROWSABLE で kakeibo:// を受ける口を足して、そこを叩く。
  const PACKAGE = 'com.tmhys.kakeibo';
  const SCHEME = 'kakeibo';

  const card = document.getElementById('kakeibo-card');
  if (!card) return;
  if (!/Android/i.test(navigator.userAgent)) return; // PC・iOS はウェブ版のまま

  const web = card.getAttribute('href');

  // 受け口が無い古い APK や、アプリが入っていない端末では
  // browser_fallback_url でウェブ版に落ちる。
  // データは端末ごとなので、どちらで開いても設定し直しにはならない。
  card.setAttribute(
    'href',
    'intent://open#Intent;scheme=' + SCHEME +
      ';package=' + PACKAGE +
      ';S.browser_fallback_url=' + encodeURIComponent(web) +
      ';end'
  );

  const mark = card.querySelector('.ext-mark');
  if (mark) mark.textContent = 'アプリ';
})();

// ---------------------------------------------------------------------------
// Claude Inbox は URL を端末に置く
// ---------------------------------------------------------------------------

(function () {
  const KEY = 'portal:inboxUrl';

  const card = document.getElementById('inbox-card');
  if (!card) return;

  const nameEl = card.querySelector('.tool-name');
  const descEl = card.querySelector('.tool-desc');
  const setBtn = document.getElementById('inbox-set');

  function read() {
    try {
      return localStorage.getItem(KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function write(value) {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch (e) {
      /* 保存できない端末では、その場かぎりのリンクとして動く */
    }
  }

  /**
   * 入れられた文字列を URL として検める。
   *
   * href に javascript: が入ると、カードを押しただけで任意のコードが動く。
   * https だけを通す。入力は自分だけとはいえ、貼り間違いで壊れる道は塞いでおく。
   */
  function normalize(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    let url;
    try {
      url = new URL(raw);
    } catch (e) {
      return '';
    }
    if (url.protocol !== 'https:') return '';
    // 合言葉を URL に付けたまま保存しない（/app#t=... で開く使い方があるため）。
    url.hash = '';
    return url.toString();
  }

  function render() {
    const url = read();

    if (url) {
      card.setAttribute('href', url);
      card.classList.remove('unset');
      nameEl.textContent = 'Claude Inbox ';
      const mark = document.createElement('span');
      mark.className = 'ext-mark';
      mark.textContent = '↗';
      nameEl.appendChild(mark);
      descEl.textContent = 'Claude との会話で決めた TODO と、相談したいことのメモ。';
      setBtn.textContent = '変更';
      return;
    }

    card.removeAttribute('href');
    card.classList.add('unset');
    nameEl.textContent = 'Claude Inbox';
    descEl.textContent = 'まだ接続先が設定されていません。「設定する」を押して /app のURLを入れてください。';
    setBtn.textContent = '設定する';
  }

  setBtn.addEventListener('click', (ev) => {
    // カード自体がリンクなので、ボタンを押したときに開かないようにする。
    ev.preventDefault();
    ev.stopPropagation();

    const current = read();
    const input = window.prompt(
      'Claude Inbox の Web 画面のURL\n' +
        '（https://claude-inbox.<サブドメイン>.workers.dev/app）\n\n' +
        '空にすると消します。合言葉は画面側で入れるのでここには書きません。',
      current
    );
    if (input === null) return;

    if (!input.trim()) {
      write('');
      render();
      return;
    }

    const url = normalize(input);
    if (!url) {
      window.alert('https:// で始まるURLを入れてください。');
      return;
    }
    write(url);
    render();
  });

  // 設定前のカードを押しても何も起きないようにする（href が無いので既定では何もしない）。
  card.addEventListener('click', (ev) => {
    if (!read()) ev.preventDefault();
  });

  render();
})();
