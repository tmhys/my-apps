'use strict';
/* ワークアウトログ PWA
   データは localStorage のみに保存（キー: workoutLogPwa.v1）。
   設定すれば habit-relay 経由で Obsidian の日記にも記録を残す（キー: workoutLogPwa.obsidian）。
   進行ルール: 全セット目標クリア & RPE<=7 で次回 +1回（秒数は +5秒）。RPE>=9 か未達で据え置き。
   メニュー: A/B/C が基本ローテーション（各2種類から交互に提示）。D（背中）とE（脚＋フットケア）は任意の日。 */

const STORE_KEY = 'workoutLogPwa.v1';

const MUSCLE_LABEL = { chest: '胸', arms: '腕・肩', core: '腹・体幹', back: '背中', legs: '脚', foot: '足・フットケア' };

const CATALOG = [
  { key: 'pushup-bar',        name: 'プッシュアップ（プッシュアップバー）', muscle: 'chest', equipment: 'プッシュアップバー', unit: 'reps', defSets: 3, defTarget: 10, art: 'push',      desc: 'バーを握って深く沈める。胸に効く基本種目' },
  { key: 'wide-pushup',       name: 'ワイドプッシュアップ',                 muscle: 'chest', equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'push',      desc: '手幅を広めに置く。胸の外側ねらい' },
  { key: 'tube-press',        name: 'チューブ・チェストプレス',             muscle: 'chest', equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'press',     desc: '背中にチューブを回し、前に押し出す' },
  { key: 'diamond-pushup',    name: 'ダイヤモンドプッシュアップ',           muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8,  art: 'push',      desc: '両手で菱形を作る。三頭ねらい' },
  { key: 'tube-kickback',     name: 'チューブ・キックバック',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'kickback',  desc: '前傾して肘を固定し、腕を後ろへ伸ばす' },
  { key: 'tube-curl',         name: 'チューブカール',                       muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'curl',      desc: 'チューブを踏んで肘を曲げる。二頭ねらい' },
  { key: 'tube-extension',    name: 'チューブ・オーバーヘッドエクステンション', muscle: 'arms', equipment: 'ゴムチューブ',     unit: 'reps', defSets: 3, defTarget: 12, art: 'extension', desc: '頭の後ろからチューブを上へ伸ばす' },
  { key: 'tube-shoulder-press', name: 'チューブ・ショルダープレス',         muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 10, art: 'pressup',   desc: 'チューブを踏んで頭上へ押し上げる' },
  { key: 'tube-side-raise',   name: 'チューブ・サイドレイズ',               muscle: 'arms',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'raise',     desc: '腕を真横に上げる。肩の中部ねらい' },
  { key: 'pike-pushup',       name: 'パイクプッシュアップ',                 muscle: 'arms',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 8,  art: 'push',      desc: '腰を高く上げ、頭を床に近づける。肩ねらい' },
  { key: 'ab-roller',         name: '腹筋ローラー',                         muscle: 'core',  equipment: '腹筋ローラー',       unit: 'reps', defSets: 3, defTarget: 8,  art: 'roller',    desc: '膝つきで前に転がして戻す。腰を反らさない' },
  { key: 'dead-bug',          name: 'デッドバグ',                           muscle: 'core',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'bug',       desc: '仰向けで対角の手足をゆっくり下ろす' },
  { key: 'plank',             name: 'プランク',                             muscle: 'core',  equipment: '自重',               unit: 'sec',  defSets: 3, defTarget: 45, art: 'plank',     desc: '肘とつま先で体を一直線に保つ' },
  { key: 'bird-dog',          name: 'バードドッグ',                         muscle: 'core',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'bug',       desc: '四つん這いで対角の手足を伸ばす。体幹と背中' },
  { key: 'tube-row',          name: 'チューブ・ローイング',                 muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'row',       desc: '座って足裏にチューブをかけ、へそへ引く。肩甲骨を寄せる' },
  { key: 'tube-pull-apart',   name: 'チューブ・プルアパート',               muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 12, art: 'pullapart', desc: '胸の高さでチューブを両手に持ち、左右に開く' },
  { key: 'superman',          name: 'スーパーマン',                         muscle: 'back',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 10, art: 'superman',  desc: 'うつ伏せで手足を同時に浮かせて2秒キープ' },
  { key: 'tube-deadlift',     name: 'チューブ・デッドリフト',               muscle: 'back',  equipment: 'ゴムチューブ',       unit: 'reps', defSets: 3, defTarget: 10, art: 'hinge',     desc: 'チューブを踏み、股関節を折って前傾→起こす。背中は丸めない' },
  { key: 'squat',             name: 'スクワット（自重）',                   muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 12, art: 'squat',     desc: '椅子に座るようにしゃがむ。膝はつま先の方向へ' },
  { key: 'split-squat',       name: 'スプリットスクワット',                 muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 2, defTarget: 8,  art: 'lunge',     desc: '前後に開いてまっすぐ上下。左右それぞれ行う' },
  { key: 'glute-bridge',      name: 'グルートブリッジ',                     muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 12, art: 'bridge',    desc: '仰向けで膝を立て、お尻を持ち上げて1秒キープ' },
  { key: 'calf-raise',        name: 'カーフレイズ',                         muscle: 'legs',  equipment: '自重',               unit: 'reps', defSets: 3, defTarget: 15, art: 'calf',      desc: 'かかとをゆっくり上げ下げ。壁に手をついてOK' },
  { key: 'towel-gather',      name: 'タオルギャザー',                       muscle: 'foot',  equipment: 'タオル',             unit: 'reps', defSets: 2, defTarget: 10, art: 'towel',     desc: '椅子に座り、足指でタオルを手前にたぐり寄せる。左右それぞれ。足のつり対策' },
  { key: 'toe-gcp',           name: '足指グーチョキパー',                   muscle: 'foot',  equipment: '自重',               unit: 'reps', defSets: 2, defTarget: 10, art: 'toes',      desc: '足指でグー・チョキ・パーを繰り返す。左右それぞれ' },
  { key: 'ankle-roll',        name: '足首回し・足指ストレッチ',             muscle: 'foot',  equipment: '自重',               unit: 'sec',  defSets: 1, defTarget: 60, art: 'ankle',     desc: '足首を大きく回し、足指を広げたり握ったりする' },
];
const EX = Object.fromEntries(CATALOG.map(e => [e.key, e]));

/* ---------- 種目のイラスト ----------
   48px の棒人間では何の動作か読めなかったので作り替えたもの。
   ・体に太さを与える（胴は太く、手足は細く、頭は塗り）
   ・開始姿勢を薄く重ねて、どこからどこへ動くかを見せる
   ・動く向きを矢印で示す（軸は細く、先端は大きく。小さいと棒に見える）
   ・効く部位をアクセント色の面で置く
   viewBox は 64。48 のままだと線が潰れて描き分けられない。 */
/** (x1,y1)→(x2,y2) の矢印。先端の三角を向きに合わせて描く。 */
function arr(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 7.5, w = 0.40;
  const ax = (x2 - h * Math.cos(a - w)).toFixed(1), ay = (y2 - h * Math.sin(a - w)).toFixed(1);
  const bx = (x2 - h * Math.cos(a + w)).toFixed(1), by = (y2 - h * Math.sin(a + w)).toFixed(1);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><path d="M${ax} ${ay} L${x2} ${y2} L${bx} ${by}Z" class="ah"/>`;
}
const A1 = (x1, y1, x2, y2) => `<g class="ar">${arr(x1, y1, x2, y2)}</g>`;
const A2 = (x1, y1, x2, y2) => `<g class="ar">${arr(x1, y1, x2, y2)}${arr(x2, y2, x1, y1)}</g>`;
/** 効く部位。丸い色面を薄く置く。 */
const HI = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="hi"/>`;

const FIG = {
  floor: '<line x1="3" y1="57" x2="61" y2="57" class="fl"/>',
  // 横向きに立つ（右を向く）
  stand: '<circle cx="30" cy="12" r="5" class="hd"/><line x1="30" y1="17" x2="30" y2="35" class="bd"/>' +
         '<line x1="30" y1="35" x2="25" y2="56" class="lb"/><line x1="30" y1="35" x2="36" y2="56" class="lb"/>',
  // 正面に立つ
  front: '<circle cx="32" cy="12" r="5" class="hd"/><line x1="32" y1="17" x2="32" y2="35" class="bd"/>' +
         '<line x1="32" y1="35" x2="26" y2="56" class="lb"/><line x1="32" y1="35" x2="38" y2="56" class="lb"/>',
};

const ART = {
  // 腕立て。薄い図が上、濃い図が下（沈んだところ）
  push: FIG.floor +
    '<g class="gh"><circle cx="48" cy="20" r="4.6" class="hd"/><line x1="16" y1="38" x2="44" y2="22" class="bd"/>' +
    '<line x1="42" y1="23" x2="42" y2="56" class="lb"/></g>' +
    HI(38, 32, 7, 5) +
    '<g class="mv-bob"><circle cx="48" cy="28" r="4.6" class="hd"/><line x1="16" y1="42" x2="44" y2="30" class="bd"/>' +
    '<line x1="16" y1="42" x2="8" y2="56" class="lb"/><line x1="42" y1="31" x2="42" y2="56" class="lb"/></g>' +
    A2(57, 20, 57, 42),

  // プランク。止める種目なので矢印は出さず、一直線を点線で示す
  plank: FIG.floor + HI(32, 36, 9, 4) +
    '<circle cx="49" cy="30" r="4.6" class="hd"/><line x1="14" y1="40" x2="45" y2="32" class="bd"/>' +
    '<line x1="14" y1="40" x2="7" y2="56" class="lb"/><line x1="43" y1="33" x2="43" y2="50" class="lb"/>' +
    '<line x1="43" y1="50" x2="53" y2="50" class="lb"/>' +
    '<line x1="8" y1="42" x2="52" y2="29" class="hold"/>',

  // チェストプレス。薄い図が引いたところ、濃い図が押し出したところ
  press: FIG.floor + FIG.stand + HI(30, 24, 6, 5) +
    '<g class="gh"><line x1="30" y1="23" x2="38" y2="27" class="lb"/><line x1="38" y1="27" x2="38" y2="20" class="lb"/></g>' +
    '<g class="mv-slide"><line x1="30" y1="23" x2="50" y2="23" class="lb"/></g>' +
    '<path d="M30 25 q-7 6 0 11" class="band"/>' + A1(40, 12, 54, 12),

  // ショルダープレス。薄い図が肩、濃い図が頭上
  pressup: FIG.floor + FIG.front + HI(32, 21, 8, 4) +
    '<g class="gh"><line x1="32" y1="22" x2="22" y2="24" class="lb"/><line x1="22" y1="24" x2="21" y2="17" class="lb"/>' +
    '<line x1="32" y1="22" x2="42" y2="24" class="lb"/><line x1="42" y1="24" x2="43" y2="17" class="lb"/></g>' +
    '<g class="mv-bobup"><line x1="32" y1="22" x2="21" y2="9" class="lb"/>' +
    '<line x1="32" y1="22" x2="43" y2="9" class="lb"/></g>' +
    '<line x1="21" y1="10" x2="26" y2="55" class="band"/><line x1="43" y1="10" x2="38" y2="55" class="band"/>' +
    A1(54, 22, 54, 8),

  // カール。薄い図が腕を下ろしたところ
  curl: FIG.floor + FIG.stand + HI(35, 28, 4, 5) +
    '<g class="gh"><line x1="30" y1="23" x2="35" y2="34" class="lb"/><line x1="35" y1="34" x2="38" y2="45" class="lb"/></g>' +
    '<line x1="30" y1="23" x2="35" y2="34" class="lb"/>' +
    '<g class="mv-swing og-lt"><line x1="35" y1="34" x2="44" y2="27" class="lb"/></g>' +
    '<line x1="40" y1="45" x2="38" y2="55" class="band"/>' + A1(52, 40, 52, 24),

  // サイドレイズ。薄い図が腕を下ろしたところ
  raise: FIG.floor + FIG.front + HI(21, 23, 5, 4) + HI(43, 23, 5, 4) +
    '<g class="gh"><line x1="32" y1="22" x2="26" y2="38" class="lb"/><line x1="32" y1="22" x2="38" y2="38" class="lb"/></g>' +
    '<g class="mv-spread og-c"><line x1="32" y1="22" x2="12" y2="25" class="lb"/>' +
    '<line x1="32" y1="22" x2="52" y2="25" class="lb"/></g>' +
    A1(14, 40, 9, 28) + A1(50, 40, 55, 28),

  // キックバック。前傾して肘を固定、前腕だけ後ろへ伸ばす
  kickback: FIG.floor + HI(21, 32, 4, 5) +
    '<circle cx="46" cy="22" r="4.8" class="hd"/><line x1="16" y1="30" x2="42" y2="24" class="bd"/>' +
    '<line x1="20" y1="29" x2="19" y2="56" class="lb"/><line x1="30" y1="27" x2="33" y2="56" class="lb"/>' +
    '<line x1="20" y1="29" x2="20" y2="40" class="lb"/>' +
    '<g class="gh"><line x1="20" y1="40" x2="24" y2="50" class="lb"/></g>' +
    '<g class="mv-swing-n og-lt"><line x1="20" y1="40" x2="8" y2="44" class="lb"/></g>' +
    A1(18, 52, 6, 50),

  // オーバーヘッドエクステンション。薄い図が頭の後ろ、濃い図が伸ばしたところ
  extension: FIG.floor + FIG.stand + HI(28, 15, 4, 5) +
    '<g class="gh"><line x1="30" y1="21" x2="24" y2="12" class="lb"/><line x1="24" y1="12" x2="33" y2="15" class="lb"/></g>' +
    '<line x1="30" y1="21" x2="24" y2="12" class="lb"/>' +
    '<g class="mv-swing-s og-lt"><line x1="24" y1="12" x2="31" y2="3" class="lb"/></g>' +
    '<line x1="31" y1="4" x2="30" y2="19" class="band"/>' + A1(45, 16, 45, 4),

  // 腹筋ローラー。薄い図が手前、濃い図が伸びたところ
  roller: FIG.floor + HI(27, 36, 7, 5) +
    '<g class="gh"><circle cx="38" cy="26" r="4.8" class="hd"/><line x1="20" y1="40" x2="35" y2="29" class="bd"/>' +
    '<line x1="35" y1="29" x2="38" y2="46" class="lb"/></g>' +
    '<circle cx="45" cy="21" r="4.8" class="hd"/><line x1="20" y1="40" x2="41" y2="24" class="bd"/>' +
    '<line x1="20" y1="40" x2="13" y2="54" class="lb"/><line x1="13" y1="54" x2="26" y2="54" class="lb"/>' +
    '<g class="mv-slide"><line x1="41" y1="25" x2="50" y2="45" class="lb"/>' +
    '<circle cx="51" cy="49" r="6" class="gear"/><line x1="44" y1="49" x2="58" y2="49" class="gear"/></g>' +
    A2(30, 12, 54, 12),

  // デッドバグ／バードドッグ。四つん這いで対角の手足を伸ばす
  bug: FIG.floor + HI(30, 36, 8, 4) +
    '<circle cx="47" cy="28" r="4.8" class="hd"/><line x1="16" y1="36" x2="43" y2="31" class="bd"/>' +
    '<g class="gh"><line x1="40" y1="32" x2="41" y2="54" class="lb"/><line x1="20" y1="35" x2="19" y2="54" class="lb"/></g>' +
    '<line x1="40" y1="32" x2="41" y2="54" class="lb"/>' +
    '<g class="mv-swing-n og-rt"><line x1="43" y1="31" x2="57" y2="26" class="lb"/></g>' +
    '<g class="mv-swing og-lt"><line x1="16" y1="36" x2="3" y2="28" class="lb"/></g>',

  // ローイング。座って足裏にチューブ、へそへ引く
  row: FIG.floor + HI(33, 30, 6, 5) +
    '<line x1="8" y1="53" x2="30" y2="53" class="lb"/><path d="M8 53 l-1 -7" class="foot"/>' +
    '<line x1="30" y1="53" x2="33" y2="26" class="bd"/><circle cx="34" cy="20" r="5" class="hd"/>' +
    '<g class="gh"><line x1="32" y1="33" x2="14" y2="45" class="lb"/></g>' +
    '<g class="mv-slide"><line x1="32" y1="33" x2="20" y2="33" class="lb"/></g>' +
    '<path d="M7 50 q7 -9 13 -16" class="band"/>' + A1(18, 19, 32, 19),

  // プルアパート。胸の高さで左右に開く
  pullapart: FIG.floor + FIG.front + HI(32, 22, 9, 4) +
    '<g class="gh"><line x1="32" y1="22" x2="22" y2="20" class="lb"/><line x1="32" y1="22" x2="42" y2="20" class="lb"/></g>' +
    '<g class="mv-spread og-c"><line x1="32" y1="22" x2="13" y2="19" class="lb"/>' +
    '<line x1="32" y1="22" x2="51" y2="19" class="lb"/>' +
    '<line x1="13" y1="19" x2="51" y2="19" class="band"/></g>' +
    A1(14, 33, 6, 33) + A1(50, 33, 58, 33),

  // スーパーマン。うつ伏せで手足を浮かせる。薄い図が床についたところ
  superman: FIG.floor + HI(30, 44, 9, 4) +
    '<g class="gh"><line x1="16" y1="52" x2="44" y2="52" class="bd"/>' +
    '<line x1="44" y1="52" x2="56" y2="52" class="lb"/><line x1="16" y1="52" x2="4" y2="52" class="lb"/></g>' +
    '<g class="mv-lift og-c"><circle cx="48" cy="40" r="4.8" class="hd"/>' +
    '<line x1="16" y1="46" x2="44" y2="42" class="bd"/>' +
    '<line x1="44" y1="42" x2="56" y2="34" class="lb"/><line x1="16" y1="46" x2="4" y2="38" class="lb"/></g>' +
    A1(30, 56, 30, 46),

  // デッドリフト。薄い図が前傾、濃い図が起きたところ
  hinge: FIG.floor + HI(26, 36, 5, 6) +
    '<line x1="30" y1="38" x2="25" y2="56" class="lb"/><line x1="30" y1="38" x2="36" y2="56" class="lb"/>' +
    '<g class="mv-hinge og-lb"><line x1="30" y1="38" x2="30" y2="16" class="bd"/>' +
    '<circle cx="30" cy="11" r="5" class="hd"/>' +
    '<line x1="30" y1="26" x2="36" y2="30" class="lb"/><line x1="36" y1="30" x2="35" y2="53" class="band"/></g>' +
    '<path d="M44 20 q8 10 2 20" class="ar"/><path d="M49 38 L46 44 L43 37Z" class="ah"/>',

  // スクワット。薄い図が立ったところ、濃い図がしゃがんだところ
  squat: FIG.floor + HI(23, 44, 5, 6) + HI(41, 44, 5, 6) +
    '<g class="gh"><circle cx="32" cy="8" r="5" class="hd"/><line x1="32" y1="13" x2="32" y2="34" class="bd"/>' +
    '<line x1="32" y1="34" x2="27" y2="56" class="lb"/><line x1="32" y1="34" x2="37" y2="56" class="lb"/></g>' +
    '<g class="mv-squat"><circle cx="32" cy="18" r="5" class="hd"/>' +
    '<line x1="32" y1="23" x2="32" y2="38" class="bd"/><line x1="32" y1="26" x2="47" y2="28" class="lb"/></g>' +
    '<line x1="32" y1="38" x2="20" y2="46" class="lb"/><line x1="20" y1="46" x2="21" y2="56" class="lb"/>' +
    '<line x1="32" y1="38" x2="44" y2="46" class="lb"/><line x1="44" y1="46" x2="43" y2="56" class="lb"/>' +
    A2(56, 18, 56, 40),

  // スプリットスクワット。前後に開いて上下
  lunge: FIG.floor + HI(42, 46, 5, 5) +
    '<g class="mv-bob"><circle cx="32" cy="12" r="5" class="hd"/>' +
    '<line x1="32" y1="17" x2="32" y2="35" class="bd"/>' +
    '<line x1="32" y1="22" x2="23" y2="30" class="lb"/><line x1="32" y1="22" x2="41" y2="30" class="lb"/></g>' +
    '<line x1="32" y1="35" x2="17" y2="44" class="lb"/><line x1="17" y1="44" x2="17" y2="56" class="lb"/>' +
    '<line x1="32" y1="35" x2="46" y2="46" class="lb"/><line x1="46" y1="46" x2="53" y2="56" class="lb"/>' +
    A2(58, 24, 58, 38),

  // ヒップリフト。薄い図が腰を下ろしたところ
  bridge: FIG.floor + HI(31, 42, 7, 4) +
    '<circle cx="9" cy="48" r="4.8" class="hd"/><line x1="14" y1="50" x2="24" y2="50" class="bd"/>' +
    '<g class="gh"><line x1="24" y1="50" x2="38" y2="50" class="bd"/></g>' +
    '<g class="mv-bobup"><line x1="24" y1="50" x2="38" y2="38" class="bd"/>' +
    '<line x1="38" y1="38" x2="41" y2="56" class="lb"/></g>' + A1(50, 50, 50, 34),

  // カーフレイズ。薄い図がかかとをつけたところ
  calf: FIG.floor + HI(27, 50, 4, 5) + HI(39, 50, 4, 5) +
    '<g class="gh"><circle cx="32" cy="14" r="5" class="hd"/><line x1="32" y1="19" x2="32" y2="37" class="bd"/>' +
    '<line x1="32" y1="37" x2="27" y2="56" class="lb"/><line x1="32" y1="37" x2="38" y2="56" class="lb"/></g>' +
    '<g class="mv-calf">' + FIG.front + '</g>' +
    '<path d="M25 56 l0 -4" class="foot"/><path d="M39 56 l0 -4" class="foot"/>' +
    A2(52, 36, 52, 50),

  // タオルギャザー。椅子に座り、足指でタオルをたぐり寄せる
  towel: FIG.floor + HI(38, 48, 8, 4) +
    '<line x1="42" y1="22" x2="42" y2="38" class="lb"/>' +
    '<path d="M42 38 q0 9 -7 11 l-9 2" class="sole" stroke-width="5"/>' +
    '<g class="mv-spread og-rt"><path d="M27 52 q-4 1 -6 4" class="toe"/>' +
    '<path d="M28 55 q-5 0 -8 2" class="toe"/></g>' +
    '<path d="M3 56 q4 -5 8 0 q4 5 8 0" class="band"/>' + A1(16, 45, 6, 45),

  // 足指グーチョキパー。足の甲を横から見て、指を開く
  toes: HI(32, 24, 11, 7) +
    '<path d="M22 50 q-3 -14 2 -22 q3 -5 8 -5 q5 0 8 5 q5 8 2 22 Z" class="sole"/>' +
    '<g class="mv-spread og-c"><line x1="25" y1="22" x2="21" y2="13" class="toe"/>' +
    '<line x1="29" y1="20" x2="27" y2="10" class="toe"/><line x1="33" y1="20" x2="34" y2="10" class="toe"/>' +
    '<line x1="37" y1="21" x2="40" y2="12" class="toe"/><line x1="40" y1="24" x2="45" y2="17" class="toe"/></g>' +
    A2(12, 18, 6, 30) + A2(52, 18, 58, 30),

  // 足首回し。足首を中心に回す
  ankle: FIG.floor +
    '<line x1="26" y1="6" x2="26" y2="28" class="bd"/>' +
    '<line x1="26" y1="28" x2="26" y2="38" class="lb"/>' +
    '<g class="mv-spin og-lt"><path d="M26 38 l11 5" class="foot"/></g>' +
    '<path d="M40 30 a13 13 0 1 1 -13 -4" class="ar"/>' +
    '<path d="M22 20 L30 24 L22 30Z" class="ah"/>',
};

function artSVG(pattern) {
  return `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${ART[pattern] || ART.push}</svg>`;
}

/* ---------- メニュー（セットメニューは複数から選べる） ---------- */
const MENUS = {
  A1: { group: 'A', label: 'A1（胸＋三頭・基本）',   items: ['pushup-bar', 'tube-press', 'diamond-pushup', 'tube-kickback'] },
  A2: { group: 'A', label: 'A2（胸＋三頭・変化球）', items: ['wide-pushup', 'pushup-bar', 'tube-extension', 'tube-kickback'] },
  B1: { group: 'B', label: 'B1（腕＋肩・基本）',     items: ['tube-curl', 'tube-extension', 'tube-shoulder-press', 'tube-side-raise'] },
  B2: { group: 'B', label: 'B2（腕＋肩・自重多め）', items: ['pike-pushup', 'tube-side-raise', 'tube-curl', 'tube-shoulder-press'] },
  C1: { group: 'C', label: 'C1（胸＋腹・基本）',     items: ['pushup-bar', 'ab-roller', 'dead-bug', 'plank'] },
  C2: { group: 'C', label: 'C2（胸＋腹・体幹寄り）', items: ['tube-press', 'ab-roller', 'bird-dog', 'dead-bug'] },
  D1: { group: 'D', label: 'D1（背中・基本）',       items: ['tube-row', 'superman', 'tube-pull-apart', 'bird-dog'] },
  D2: { group: 'D', label: 'D2（背中・ヒンジ入り）', items: ['tube-deadlift', 'tube-row', 'superman', 'plank'] },
  E1: { group: 'E', label: 'E1（脚＋フットケア）',   items: ['squat', 'calf-raise', 'towel-gather', 'toe-gcp'], note: '脚の日。レース週とレース前日は避ける' },
  E2: { group: 'E', label: 'E2（脚バランス＋足）',   items: ['split-squat', 'glute-bridge', 'calf-raise', 'ankle-roll'], note: '脚の日。レース週とレース前日は避ける' },
};
const MENU_ORDER = Object.keys(MENUS);
const ROTATION = ['A', 'B', 'C'];
const LEGACY_LABEL = { A: 'A（胸＋三頭）', B: 'B（腕＋肩）', C: 'C（胸＋腹）' };
function menuLabel(id) {
  if (id === 'free') return '自由';
  if (MENUS[id]) return MENUS[id].label;
  return LEGACY_LABEL[id] || id;
}
function groupOf(id) { return MENUS[id] ? MENUS[id].group : (LEGACY_LABEL[id] ? id : null); }

function defaultState() {
  return { settings: { weeklyTarget: 3, targetMinutes: 30, restSec: 60 }, sessions: [] };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.sessions) || !s.settings) return defaultState();
    // 古い書き出しを読んでも落ちないよう、後から足した設定は既定で埋める。
    if (typeof s.settings.restSec !== 'number') s.settings.restSec = 60;
    return s;
  } catch { return defaultState(); }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
let state = load();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function sortedSessions() {
  return [...state.sessions].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
}
function lastLogFor(key) {
  for (const s of sortedSessions()) {
    const log = (s.logs || []).find(l => l.key === key);
    if (log) return { session: s, log };
  }
  return null;
}
/* 次回の目標: { sets: セット数, target: 1セットの目標 } */
function nextTargetFor(key) {
  const ex = EX[key];
  const found = lastLogFor(key);
  if (!found || typeof found.log.target !== 'number') {
    return { sets: ex.defSets, target: ex.defTarget };
  }
  const { log } = found;
  const setsCount = log.sets.length || ex.defSets;
  const cleared = log.sets.length > 0 && log.sets.every(v => v >= log.target);
  const easy = typeof log.effort === 'number' && log.effort <= 7;
  let target = log.target;
  if (cleared && easy) target += ex.unit === 'sec' ? 5 : 1;
  return { sets: setsCount, target };
}
function nextMenu() {
  const last = sortedSessions().find(s => ROTATION.includes(groupOf(s.template)));
  const group = last ? ROTATION[(ROTATION.indexOf(groupOf(last.template)) + 1) % ROTATION.length] : 'A';
  const variants = MENU_ORDER.filter(id => MENUS[id].group === group);
  const done = state.sessions.filter(s => groupOf(s.template) === group).length;
  return variants[done % variants.length];
}
function weekCount() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 月曜=0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lo = fmt(monday), hi = fmt(sunday);
  return state.sessions.filter(s => s.date >= lo && s.date <= hi).length;
}
function fmtSets(log) {
  const unit = EX[log.key] && EX[log.key].unit === 'sec' ? '秒' : '回';
  return log.sets.join(' / ') + unit;
}
function unitOf(key) { return EX[key] && EX[key].unit === 'sec' ? '秒' : '回'; }

/* ---------- 集計 ---------- */

/**
 * 種目ごとの自己ベスト。1セットの最高値と、それを出した日。
 *
 * 自重とチューブは重量が動かないので、回数と秒数が自己ベストになる。
 * 重量を扱うアプリの 1RM 推定はここでは意味を持たないので置かない。
 */
function personalBests() {
  const best = {};
  state.sessions.forEach(s => {
    (s.logs || []).forEach(l => {
      (l.sets || []).forEach(v => {
        const n = Number(v) || 0;
        if (n <= 0) return;
        if (!best[l.key] || n > best[l.key].value) best[l.key] = { value: n, date: s.date };
      });
    });
  });
  return best;
}

/** 保存前の自己ベスト。保存時に更新を見つけるために使う。 */
function bestValueFor(key) {
  const b = personalBests()[key];
  return b ? b.value : 0;
}

/** 1回分の総回数。秒数の種目は単位が違うので混ぜない。 */
function sessionVolume(s) {
  let total = 0;
  (s.logs || []).forEach(l => {
    if (EX[l.key] && EX[l.key].unit === 'sec') return;
    (l.sets || []).forEach(v => { total += Number(v) || 0; });
  });
  return total;
}

/** 直近 n 週の部位別セット数。 */
function muscleBalance(weeks) {
  const from = new Date();
  from.setDate(from.getDate() - weeks * 7);
  const lo = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const by = {};
  state.sessions.filter(s => s.date >= lo).forEach(s => {
    (s.logs || []).forEach(l => {
      const ex = EX[l.key];
      if (!ex) return;
      by[ex.muscle] = (by[ex.muscle] || 0) + (l.sets || []).length;
    });
  });
  return by;
}

/** 連続して週の目標を満たした週の数と、今週の消化数。 */
function streak() {
  const dates = new Set(state.sessions.map(s => s.date));
  const target = state.settings.weeklyTarget || 3;
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  let weeks = 0;
  // 今週は途中なので数えない。先週から遡って、目標を満たした週を数える。
  for (let i = 1; i < 104; i++) {
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - i * 7);
    let n = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + d);
      if (dates.has(fmt(day))) n++;
    }
    if (n >= target) weeks++; else break;
  }
  return { weeks: weeks, thisWeek: weekCount(), target: target };
}

/* ---------- レストタイマー ----------
   どの筋トレアプリも中核に置いている機能。セットを入れたら自動で動き出し、
   残りを画面上部に出す。30分で終わらせる運用では、休みすぎの防止に効く。
   0 秒に設定すると止まる。 */

let restEnd = 0;        // 終了時刻（ミリ秒）。0 なら止まっている
let restTotal = 0;      // 進み具合のバー用
let restTick = null;

function restEls() {
  return {
    bar: document.getElementById('rest-bar'),
    left: document.getElementById('rest-left'),
    fill: document.getElementById('rest-fill'),
  };
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60), r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function startRest(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return;           // 設定が 0 なら使わない
  restTotal = n;
  restEnd = Date.now() + n * 1000;
  restEls().bar.hidden = false;
  if (!restTick) restTick = setInterval(tickRest, 200);
  tickRest();
}

function stopRest() {
  restEnd = 0;
  if (restTick) { clearInterval(restTick); restTick = null; }
  restEls().bar.hidden = true;
}

function addRest(sec) {
  if (!restEnd) return;
  restEnd = Math.max(Date.now() + 1000, restEnd + sec * 1000);
  restTotal = Math.max(restTotal + sec, 1);
  tickRest();
}

function tickRest() {
  const { left, fill } = restEls();
  const ms = restEnd - Date.now();
  if (ms <= 0) { restDone(); return; }
  const sec = Math.ceil(ms / 1000);
  left.textContent = fmtClock(sec);
  fill.style.width = `${Math.max(0, Math.min(100, (1 - sec / restTotal) * 100))}%`;
}

function restDone() {
  stopRest();
  beep();
  try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* 使えない端末は鳴らすだけ */ }
}

/** 短い電子音。音声ファイルを持たずに鳴らす（オフラインでも鳴るように）。 */
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => { try { ctx.close(); } catch (e) { /* noop */ } };
  } catch (e) {
    /* 音が出せない端末でも、バイブと表示で足りる */
  }
}

document.getElementById('rest-skip').addEventListener('click', stopRest);
document.getElementById('rest-minus').addEventListener('click', () => addRest(-15));
document.getElementById('rest-plus').addEventListener('click', () => addRest(15));

/* ---------- 画面遷移 ---------- */
const views = ['view-home', 'view-editor', 'view-history', 'view-progress', 'view-settings'];
function show(viewId) {
  views.forEach(v => document.getElementById(v).classList.toggle('active', v === viewId));
  document.querySelectorAll('.tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === viewId));
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-history') renderHistory();
  if (viewId === 'view-progress') renderProgress();
  if (viewId === 'view-settings') renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.view)));

/* ---------- ホーム ---------- */
let currentMenu = null;
function renderHome() {
  if (!currentMenu || !MENUS[currentMenu]) currentMenu = nextMenu();
  const menu = MENUS[currentMenu];
  document.getElementById('week-count').textContent =
    `今週 ${weekCount()} / ${state.settings.weeklyTarget} 回`;
  document.getElementById('next-template').textContent = menu.label;
  document.getElementById('next-note').textContent = menu.note || '';
  const ul = document.getElementById('next-exercises');
  ul.innerHTML = '';
  menu.items.forEach(key => {
    const ex = EX[key];
    const nt = nextTargetFor(key);
    const li = document.createElement('li');
    li.innerHTML = `<span class="ex-art"></span><span class="ex-main"><span class="ex-name"></span><span class="ex-desc"></span></span><span class="target"></span>`;
    li.querySelector('.ex-art').innerHTML = artSVG(ex.art);
    li.querySelector('.ex-name').textContent = ex.name;
    li.querySelector('.ex-desc').textContent = ex.desc;
    li.querySelector('.target').textContent = `${nt.sets}セット × ${nt.target}${ex.unit === 'sec' ? '秒' : '回'}`;
    ul.appendChild(li);
  });
  const recent = document.getElementById('recent-list');
  const last3 = sortedSessions().slice(0, 3);
  recent.innerHTML = last3.length ? '' : '<p class="empty">まだ記録はありません</p>';
  last3.forEach(s => recent.appendChild(sessionItemEl(s, false)));
}
document.getElementById('btn-start').addEventListener('click', () => openEditor(currentMenu));
document.getElementById('btn-other-menu').addEventListener('click', () => {
  const group = MENUS[currentMenu].group;
  const variants = MENU_ORDER.filter(id => MENUS[id].group === group);
  if (variants.length > 1) {
    currentMenu = variants[(variants.indexOf(currentMenu) + 1) % variants.length];
  } else {
    const all = ['A', 'B', 'C', 'D', 'E'];
    const nextGroup = all[(all.indexOf(group) + 1) % all.length];
    currentMenu = MENU_ORDER.find(id => MENUS[id].group === nextGroup);
  }
  renderHome();
});
document.getElementById('btn-open-back').addEventListener('click', () => { currentMenu = 'D1'; openEditor('D1'); });
document.getElementById('btn-open-legs').addEventListener('click', () => { currentMenu = 'E1'; openEditor('E1'); });

/* ---------- 記録入力 ---------- */
let editorLogs = [];   // { key, target, sets: [..], effort, variation }
let editorLeg = null;

const templateSel = document.getElementById('f-template');
['A', 'B', 'C', 'D', 'E'].forEach(g => {
  const og = document.createElement('optgroup');
  og.label = { A: 'A 胸＋三頭', B: 'B 腕＋肩', C: 'C 胸＋腹', D: 'D 背中', E: 'E 脚＋フットケア' }[g];
  MENU_ORDER.filter(id => MENUS[id].group === g).forEach(id => {
    const o = document.createElement('option');
    o.value = id; o.textContent = MENUS[id].label;
    og.appendChild(o);
  });
  templateSel.appendChild(og);
});
const freeOpt = document.createElement('option');
freeOpt.value = 'free'; freeOpt.textContent = '自由';
templateSel.appendChild(freeOpt);

function openEditor(menuId) {
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-template').value = menuId;
  document.getElementById('f-runfeel').value = '';
  document.getElementById('f-note').value = '';
  editorLeg = null;
  document.querySelectorAll('#f-leg button').forEach(b => b.classList.remove('on'));
  buildEditorLogs(menuId);
  show('view-editor');
}
function buildEditorLogs(menuId) {
  editorLogs = [];
  const items = menuId === 'free' ? [] : MENUS[menuId].items;
  items.forEach(key => {
    const nt = nextTargetFor(key);
    editorLogs.push({ key, target: nt.target, sets: Array(nt.sets).fill(nt.target), effort: '', variation: '' });
  });
  renderEditorLogs();
}
templateSel.addEventListener('change', e => buildEditorLogs(e.target.value));

function renderEditorLogs() {
  const wrap = document.getElementById('editor-exercises');
  wrap.innerHTML = '';
  editorLogs.forEach((log, idx) => {
    const ex = EX[log.key];
    const div = document.createElement('div');
    div.className = 'ex-block';
    const unitLabel = ex.unit === 'sec' ? '秒' : '回';
    const best = personalBests()[log.key];
    div.innerHTML = `
      <div class="ex-head"><span class="ex-art"></span><div><h3></h3>
      <div class="ex-meta">${MUSCLE_LABEL[ex.muscle]} ・ ${ex.equipment} ・ 目標 ${log.target}${unitLabel} × ${log.sets.length}セット</div>
      <div class="ex-desc"></div>
      ${best ? `<div class="ex-pr">自己ベスト ${best.value}${unitLabel}（${best.date.slice(5).replace('-', '/')}）</div>` : ''}
      </div></div>
      <div class="sets"></div>
      <div class="ex-row">
        <label>RPE（きつさ 1〜10）<input type="number" min="1" max="10" step="1" inputmode="numeric" data-f="effort" placeholder="例：7"></label>
        <label>バリエーション<input type="text" data-f="variation" placeholder="例：膝つき"></label>
      </div>
      <button type="button" class="ex-remove">この種目を外す</button>`;
    div.querySelector('.ex-art').innerHTML = artSVG(ex.art);
    div.querySelector('h3').textContent = ex.name;
    div.querySelector('.ex-desc').textContent = ex.desc;
    const setsWrap = div.querySelector('.sets');
    log.sets.forEach((v, si) => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.max = '999'; inp.inputMode = 'numeric';
      inp.value = v;
      // 初めてやる種目はこれまでの最高が 0。保存時の判定（top > prev）と揃える。
      const prevBest = best ? best.value : 0;
      if ((Number(v) || 0) > prevBest) inp.classList.add('is-pr');
      inp.addEventListener('input', () => {
        log.sets[si] = parseInt(inp.value, 10) || 0;
        inp.classList.toggle('is-pr', log.sets[si] > prevBest);
      });
      // 入力を終えた＝そのセットが終わった、とみなして休憩を始める。
      inp.addEventListener('change', () => {
        if (log.sets[si] > 0) startRest(state.settings.restSec);
      });
      setsWrap.appendChild(inp);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'mini'; addBtn.textContent = '＋セット';
    addBtn.addEventListener('click', () => { log.sets.push(log.target); renderEditorLogs(); });
    setsWrap.appendChild(addBtn);
    if (log.sets.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'mini'; delBtn.textContent = '−セット';
      delBtn.addEventListener('click', () => { log.sets.pop(); renderEditorLogs(); });
      setsWrap.appendChild(delBtn);
    }
    div.querySelector('[data-f="effort"]').addEventListener('input', e => { log.effort = e.target.value; });
    div.querySelector('[data-f="variation"]').addEventListener('input', e => { log.variation = e.target.value; });
    div.querySelector('.ex-remove').addEventListener('click', () => { editorLogs.splice(idx, 1); renderEditorLogs(); });
    wrap.appendChild(div);
  });
}
const addSel = document.getElementById('f-add-exercise');
CATALOG.forEach(ex => {
  const o = document.createElement('option');
  o.value = ex.key; o.textContent = `${ex.name}（${MUSCLE_LABEL[ex.muscle]}）`;
  addSel.appendChild(o);
});
document.getElementById('btn-add-exercise').addEventListener('click', () => {
  const key = addSel.value;
  if (editorLogs.some(l => l.key === key)) return;
  const nt = nextTargetFor(key);
  editorLogs.push({ key, target: nt.target, sets: Array(nt.sets).fill(nt.target), effort: '', variation: '' });
  renderEditorLogs();
});
document.querySelectorAll('#f-leg button').forEach(b =>
  b.addEventListener('click', () => {
    editorLeg = editorLeg === Number(b.dataset.v) ? null : Number(b.dataset.v);
    document.querySelectorAll('#f-leg button').forEach(x =>
      x.classList.toggle('on', Number(x.dataset.v) === editorLeg));
  }));
document.getElementById('btn-cancel').addEventListener('click', () => { stopRest(); show('view-home'); });
document.getElementById('btn-save').addEventListener('click', () => {
  const date = document.getElementById('f-date').value;
  if (!date) { alert('日付を選んでください'); return; }
  if (!editorLogs.length) { alert('種目がありません'); return; }
  const logs = editorLogs.map(l => {
    const ex = EX[l.key];
    const effort = parseInt(l.effort, 10);
    return {
      key: l.key, name: ex.name, muscle: ex.muscle, equipment: ex.equipment,
      target: l.target,
      sets: l.sets.map(v => Math.max(0, parseInt(v, 10) || 0)),
      variation: (l.variation || '').trim(),
      effort: Number.isFinite(effort) && effort >= 1 && effort <= 10 ? effort : null,
    };
  });
  // 保存する前の自己ベストと比べる（保存後だと今回の記録が混ざる）。
  const before = personalBests();
  const broke = logs
    .map(l => {
      const top = Math.max(0, ...l.sets);
      const prev = before[l.key] ? before[l.key].value : 0;
      return top > prev ? `${EX[l.key].name} ${top}${unitOf(l.key)}` : null;
    })
    .filter(Boolean);

  const entry = {
    id: uid(),
    date,
    template: document.getElementById('f-template').value,
    legFatigue: editorLeg,
    runFeel: document.getElementById('f-runfeel').value.trim(),
    note: document.getElementById('f-note').value.trim(),
    logs,
  };
  state.sessions.push(entry);
  save();
  // Obsidianへの転記は待たない（圏外でも保存は終わっていてよい。outbox が後で送る）
  sendSession(entry);
  stopRest();
  currentMenu = null; // 次回メニューを再計算
  if (broke.length) alert(`自己ベスト更新\n\n${broke.join('\n')}`);
  show('view-history');
});

/* ---------- 履歴 ---------- */
function sessionItemEl(s, withDelete) {
  const div = document.createElement('div');
  div.className = 'session-item';
  const head = document.createElement('div');
  head.className = 'session-head';
  head.innerHTML = `<span class="date"></span><span></span>`;
  head.children[0].textContent = s.date;
  head.children[1].textContent = menuLabel(s.template);
  div.appendChild(head);
  const detail = document.createElement('div');
  detail.className = 'session-detail';
  const lines = (s.logs || []).map(l =>
    `${l.name}：${fmtSets(l)}${typeof l.target === 'number' ? `（目標 ${l.target}）` : ''}${l.effort ? ` RPE${l.effort}` : ''}${l.variation ? ` / ${l.variation}` : ''}`);
  if (s.legFatigue) lines.push(`脚の疲労感：${s.legFatigue} / 5`);
  if (s.runFeel) lines.push(`ラン感覚：${s.runFeel}`);
  if (s.note) lines.push(`メモ：${s.note}`);
  detail.textContent = lines.join('\n');
  detail.style.whiteSpace = 'pre-line';
  div.appendChild(detail);
  if (withDelete && obsReady()) {
    // 連携を後から設定したときや、送れなかったものを手で送るため。
    // 同じ記録を送り直しても受け側が書き換えるだけなので、増えない。
    const push = document.createElement('button');
    push.className = 'del'; push.textContent = '日記に送る';
    push.addEventListener('click', async () => {
      push.disabled = true; push.textContent = '送信中…';
      await sendSession(s);
      const left = outbox().some(x => x.session.id === s.id);
      push.textContent = left ? '送れませんでした' : '送りました';
      if (left) push.disabled = false;
    });
    detail.appendChild(document.createElement('br'));
    detail.appendChild(push);
  }
  if (withDelete) {
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = 'この記録を削除';
    del.addEventListener('click', () => {
      if (!confirm(`${s.date} の記録を削除しますか？`)) return;
      state.sessions = state.sessions.filter(x => x.id !== s.id);
      save(); renderHistory(); renderHome();
    });
    detail.appendChild(document.createElement('br'));
    detail.appendChild(del);
  }
  return div;
}
function renderHistory() {
  const wrap = document.getElementById('history-list');
  const list = sortedSessions();
  wrap.innerHTML = list.length ? '' : '<p class="empty">まだ記録はありません</p>';
  list.forEach(s => wrap.appendChild(sessionItemEl(s, true)));
}

/* ---------- 進捗 ---------- */
function renderProgress() {
  renderCalendar();
  renderVolume();
  renderBalance();
  renderPR();
  renderNextTargets();
}

/** 続いているか。直近12週のカレンダー。 */
function renderCalendar() {
  const byDate = {};
  state.sessions.forEach(s => { byDate[s.date] = groupOf(s.template) || '-'; });

  const st = streak();
  const sum = document.getElementById('streak-summary');
  sum.textContent = st.weeks
    ? `今週 ${st.thisWeek}/${st.target} 回 ・ 週の目標を ${st.weeks} 週つづけて達成中`
    : `今週 ${st.thisWeek}/${st.target} 回`;

  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const WEEKS = 12;
  const wrap = document.getElementById('calendar');
  wrap.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (let w = WEEKS - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - w * 7 + d);
      const key = fmt(day);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (day > now) cell.classList.add('future');
      if (byDate[key]) {
        cell.classList.add('on');
        cell.textContent = byDate[key];
      }
      cell.title = key;
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
}

/** 1回あたりの総回数。直近12回を棒で。 */
function renderVolume() {
  const wrap = document.getElementById('volume-chart');
  const rows = sortedSessions().slice(0, 12).reverse()
    .map(s => ({ date: s.date.slice(5).replace('-', '/'), v: sessionVolume(s) }))
    .filter(r => r.v > 0);

  if (!rows.length) { wrap.innerHTML = '<p class="empty">記録が貯まるとここに表示されます</p>'; return; }

  const max = Math.max(...rows.map(r => r.v));
  wrap.innerHTML =
    '<div class="bars">' +
    rows.map(r =>
      `<div class="bar-col"><div class="bar-v">${r.v}</div>` +
      `<div class="bar" style="height:${Math.max(4, Math.round(r.v / max * 100))}%"></div>` +
      `<div class="bar-x">${r.date}</div></div>`
    ).join('') + '</div>';
}

/** 部位のバランス。直近4週のセット数を横棒で。 */
function renderBalance() {
  const wrap = document.getElementById('muscle-balance');
  const by = muscleBalance(4);
  const keys = Object.keys(MUSCLE_LABEL).filter(k => by[k]);
  if (!keys.length) { wrap.innerHTML = '<p class="empty">直近4週の記録がありません</p>'; return; }

  const total = keys.reduce((a, k) => a + by[k], 0);
  const max = Math.max(...keys.map(k => by[k]));
  wrap.innerHTML = keys.sort((a, b) => by[b] - by[a]).map(k =>
    `<div class="mb-row"><div class="mb-head">` +
    `<span>${MUSCLE_LABEL[k]}</span>` +
    `<span class="mb-n">${by[k]}セット・${Math.round(by[k] / total * 100)}%</span></div>` +
    `<div class="mb-track"><div class="mb-fill" style="width:${Math.round(by[k] / max * 100)}%"></div></div></div>`
  ).join('');
}

/** 自己ベスト。 */
function renderPR() {
  const wrap = document.getElementById('pr-list');
  const best = personalBests();
  const keys = CATALOG.map(e => e.key).filter(k => best[k]);
  if (!keys.length) { wrap.innerHTML = '<p class="empty">記録が貯まるとここに表示されます</p>'; return; }

  wrap.innerHTML = keys.map(k =>
    `<div class="pr-row"><span class="pr-name"></span>` +
    `<span class="pr-v">${best[k].value}${unitOf(k)}<span class="pr-d"> ${best[k].date.slice(5).replace('-', '/')}</span></span></div>`
  ).join('');
  // 種目名はテキストとして入れる（名前に記号が入っても壊れないように）
  wrap.querySelectorAll('.pr-name').forEach((el, i) => { el.textContent = EX[keys[i]].name; });
}

/** 種目ごとの前回と次回目標。 */
function renderNextTargets() {
  const wrap = document.getElementById('progress-list');
  wrap.innerHTML = '';
  let any = false;
  CATALOG.forEach(ex => {
    const found = lastLogFor(ex.key);
    if (!found) return;
    any = true;
    const nt = nextTargetFor(ex.key);
    const div = document.createElement('div');
    div.className = 'session-item';
    div.innerHTML = `<div class="session-head"><span class="date"></span><span class="target"></span></div>
      <div class="session-detail"></div>`;
    div.querySelector('.date').textContent = ex.name;
    div.querySelector('.target').textContent = `次回 ${nt.sets}セット × ${nt.target}${unitOf(ex.key)}`;
    div.querySelector('.session-detail').textContent =
      `前回（${found.session.date}）：${fmtSets(found.log)}${found.log.effort ? ` RPE${found.log.effort}` : ''}`;
    wrap.appendChild(div);
  });
  if (!any) wrap.innerHTML = '<p class="empty">記録が貯まるとここに表示されます</p>';
}

/* ---------- Obsidian連携 ----------
   記録を保存したら、habit-relay（gas/habit-relay）経由で github_obsidian に送り、
   その日のストリームノート（05_Stream）にメニューと種目を1件として残す。
   習慣「💪 筋トレ」も受け側の workflow の中で一緒に立つので、ここからは送らない。

   接続先（URLと合言葉）は記録本体とは別のキーに置く。JSONの書き出しに
   合言葉を混ぜたくないため（書き出しファイルは手元に残すもの）。
   送れなかったものは outbox に積み、次にアプリを開いたときや設定画面から送り直す。
   同じ記録を送り直しても、受け側が id で行を書き換えるので二重にはならない。 */

const OBS_KEY = 'workoutLogPwa.obsidian';
const OUTBOX_KEY = 'workoutLogPwa.outbox';
const OUTBOX_MAX = 50;
const OUTBOX_TRIES = 5; // これを超えたら自動送信はやめる（設定画面から手動で送れる）

function obsConfig() {
  try {
    const raw = localStorage.getItem(OBS_KEY);
    const c = raw ? JSON.parse(raw) : null;
    return { url: (c && c.url) || '', token: (c && c.token) || '' };
  } catch { return { url: '', token: '' }; }
}
function setObsConfig(c) {
  try { localStorage.setItem(OBS_KEY, JSON.stringify(c)); } catch {}
}
function obsReady() {
  const c = obsConfig();
  return !!(c.url && c.token);
}

function outbox() {
  try {
    const list = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function setOutbox(list) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-OUTBOX_MAX))); } catch {}
}
function outboxPut(session) {
  const list = outbox().filter(x => x.session.id !== session.id); // 同じ記録は1件だけ
  list.push({ session, tries: 0, error: '' });
  setOutbox(list);
}
function outboxDrop(id) {
  setOutbox(outbox().filter(x => x.session.id !== id));
}

/**
 * 保存した記録を、受け側（add_strength.py）が読む形に組み直す。
 * 記録した日の 05_Stream に入るよう epoch を渡す。過去の日を選んで
 * あとから入力したときは、その日の12:00として送る（時刻は分からないため）。
 */
function sessionPayload(s) {
  const exercises = (s.logs || []).map(l => {
    const sets = (l.sets || []).map(v => Math.max(0, parseInt(v, 10) || 0)).filter(v => v > 0);
    const ex = {
      name: l.name || (EX[l.key] ? EX[l.key].name : l.key),
      sets,
      unit: unitOf(l.key),
    };
    if (l.effort) ex.effort = l.effort;
    if (l.variation) ex.variation = l.variation;
    return ex;
  }).filter(ex => ex.sets.length);

  let epoch = Math.floor(Date.now() / 1000);
  if (s.date && s.date !== todayStr()) {
    const noon = new Date(`${s.date}T12:00:00`);
    if (!isNaN(noon.getTime())) epoch = Math.floor(noon.getTime() / 1000);
  }

  const payload = { id: s.id, epoch, menu: menuLabel(s.template), exercises };
  if (s.legFatigue) payload.legFatigue = s.legFatigue;
  if (s.runFeel) payload.runFeel = s.runFeel;
  if (s.note) payload.note = s.note;
  return payload;
}

/**
 * habit-relay に投げる。Content-Type を text/plain にするのは、ほかのアプリと
 * 同じ理由（gas は CORS のプリフライトに答えられない）。
 * 戻り値: 'sent' / 'retry'（通信やサーバの不調。あとで送り直す）/ Error（内容の不備）
 */
async function relaySend(session) {
  const c = obsConfig();
  if (!c.url || !c.token) throw new Error('設定画面で中継のURLと合言葉を入力してください');
  let url;
  try { url = new URL(c.url); } catch { throw new Error('中継のURLが正しい形式ではありません'); }

  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: c.token, action: 'strength', session }),
    });
  } catch {
    return 'retry'; // 圏外・機内モードなど
  }
  if (!res.ok) return 'retry';

  let data;
  try { data = await res.json(); } catch { return 'retry'; }
  if (data && data.ok) return 'sent';
  throw new Error((data && data.error) || '送れませんでした');
}

/** 記録を1件送る。送れなければ outbox に残す。画面は止めない。 */
async function sendSession(s) {
  const session = sessionPayload(s);
  if (!session.exercises.length) return; // 全セット0の記録は送らない
  if (!obsReady()) return;
  outboxPut(session); // 先に積む。送信中にアプリを閉じても消えない
  try {
    const r = await relaySend(session);
    if (r === 'sent') outboxDrop(session.id);
    else markOutboxError(session.id, '通信できませんでした');
  } catch (err) {
    markOutboxError(session.id, String((err && err.message) || err));
  }
  renderObsStatus();
}

function markOutboxError(id, message) {
  const list = outbox();
  const item = list.find(x => x.session.id === id);
  if (!item) return;
  item.tries = (item.tries || 0) + 1;
  item.error = message;
  setOutbox(list);
}

/** 溜まったものを順に送る。force のときは諦めた分も送り直す。 */
async function flushOutbox(force) {
  if (!obsReady()) return;
  for (const item of outbox()) {
    if (!force && (item.tries || 0) >= OUTBOX_TRIES) continue;
    try {
      const r = await relaySend(item.session);
      if (r === 'sent') outboxDrop(item.session.id);
      else { markOutboxError(item.session.id, '通信できませんでした'); break; } // 圏外なら以降も同じ
    } catch (err) {
      markOutboxError(item.session.id, String((err && err.message) || err));
    }
  }
  renderObsStatus();
}

function renderObsStatus() {
  const el = document.getElementById('obs-status');
  if (!el) return;
  if (!obsReady()) { el.textContent = '未設定（送信しません）'; return; }
  const list = outbox();
  if (!list.length) { el.textContent = '送信済み（未送信はありません）'; return; }
  const last = list[list.length - 1];
  el.textContent = `未送信 ${list.length} 件${last.error ? `／${last.error}` : ''}`;
}

/* ---------- 設定・データ ---------- */
function renderSettings() {
  document.getElementById('s-weekly').value = state.settings.weeklyTarget;
  document.getElementById('s-minutes').value = state.settings.targetMinutes;
  document.getElementById('s-rest').value = state.settings.restSec;
  const c = obsConfig();
  document.getElementById('s-obs-url').value = c.url;
  document.getElementById('s-obs-token').value = c.token;
  renderObsStatus();
}

document.getElementById('btn-save-obs').addEventListener('click', async () => {
  const url = document.getElementById('s-obs-url').value.trim();
  const token = document.getElementById('s-obs-token').value.trim();
  if (url && !/^https:\/\//.test(url)) { alert('中継のURLは https:// から始まるものを入れてください'); return; }
  setObsConfig({ url, token });
  renderObsStatus();
  alert(url && token ? '連携先を保存しました' : '連携先を消しました（送信しません）');
  if (url && token) await flushOutbox(true);
});

document.getElementById('btn-send-obs').addEventListener('click', async () => {
  if (!obsReady()) { alert('先に中継のURLと合言葉を入力してください'); return; }
  const list = outbox();
  if (!list.length) { alert('未送信の記録はありません'); return; }
  await flushOutbox(true);
  const left = outbox().length;
  alert(left ? `${left} 件が残りました。${outbox()[0].error || ''}` : 'すべて送りました');
});
document.getElementById('btn-save-settings').addEventListener('click', () => {
  const w = parseInt(document.getElementById('s-weekly').value, 10);
  const m = parseInt(document.getElementById('s-minutes').value, 10);
  if (Number.isFinite(w) && w >= 1 && w <= 14) state.settings.weeklyTarget = w;
  if (Number.isFinite(m) && m >= 5 && m <= 180) state.settings.targetMinutes = m;
  const r = parseInt(document.getElementById('s-rest').value, 10);
  if (Number.isFinite(r) && r >= 0 && r <= 600) state.settings.restSec = r;
  save();
  alert('設定を保存しました');
});
document.getElementById('btn-export').addEventListener('click', () => {
  const name = `workout-log-backup-${todayStr()}.json`;
  const text = JSON.stringify(state, null, 2);

  // Android アプリ（WebView）の中では a[download] が効かず、何も起きない。
  // アプリが橋渡し（window.WorkoutApp.saveFile）を出しているならそちらに渡す。
  if (window.WorkoutApp && typeof window.WorkoutApp.saveFile === 'function') {
    window.WorkoutApp.saveFile(name, text);
    return;
  }

  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('f-import').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.sessions) || !data.settings) throw new Error('bad format');
      if (!confirm('現在のデータを、読み込んだファイルの内容で置き換えますか？')) return;
      state = data;
      save();
      alert('読み込みました');
      show('view-home');
    } catch {
      alert('読み込めませんでした。ワークアウトログの書き出しファイルを選んでください。');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
document.getElementById('btn-wipe').addEventListener('click', () => {
  if (!confirm('全データを削除しますか？この操作は戻せません。')) return;
  if (!confirm('本当に削除しますか？先にJSONで書き出しておくのがおすすめです。')) return;
  state = defaultState();
  save();
  show('view-home');
});

/* ---------- 初期表示 ---------- */
renderHome();
// 前回送れなかった分を拾う（圏外で保存したときなど）
flushOutbox(false);
