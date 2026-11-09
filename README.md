# マイツール（my-apps）

自分のための小さなツールをまとめた、モジュール式のPWAポータル。
ホーム画面に追加するのはこのポータル1つだけ。ツールはモジュールとして追加していく。

もともと Muse のスペースで作っていたツールを「正本は自分のGitHubに置く」方針で移植したもの。
コードもデータ形式もプレーンなファイルなので、特定のサービスにロックインされない。

## モジュール

| モジュール | 場所 | データの持ち方 | 内容 |
|---|---|---|---|
| ワークアウトログ | `workout/` | 端末内のみ（Android アプリ版あり → `android/`） | 自宅筋トレの記録。A/B/Cローテーション＋背中・脚・フットケア、進行ルール、脚の疲労感の記録 |
| 立替精算 | `reimburse/` | 接続先のGAS | 妻が立て替えた分の未精算と送金額。送金したら精算済みにする。バックエンドは [tmhys/gas](https://github.com/tmhys/gas) の `receipt-reimbursement` |
| 買い物メモ | `shopping/` | 接続先のGAS | LINE で来た「買っといて」と欲しいもの。発注待ち／未確認／欲しいもの／発注済の4タブ。バックエンドは [tmhys/gas](https://github.com/tmhys/gas) の `household-ordering` |

## 別アプリ（ポータルからリンクするだけ）

ホーム画面に置くのはこのポータル1つで済むように、外にある自分のアプリへのリンクも
トップに並べている。コードは各リポジトリのままで、ここでは何も持たない。

| アプリ | リポジトリ | リンク先の持ち方 |
|---|---|---|
| 習慣グリッド | [tmhys/habit-pwa](https://github.com/tmhys/habit-pwa) | `index.html` に直書き（ウェブ版） |
| らくな家計簿 | [tmhys/kakeibo-pwa](https://github.com/tmhys/kakeibo-pwa) | Android では **`kakeibo://`**（`portal.js`）、それ以外はウェブ版 |
| Claude Inbox | [tmhys/my_apps](https://github.com/tmhys/my_apps) の `apps/claude-inbox` | **端末の localStorage**（`portal.js`） |

前の2つは GitHub Pages のプロジェクトページ（`https://tmhys.github.io/<repo>/`）で、
もともと公開されているので直書きしている。公開先を変えたらルートの `index.html` を直す。

**らくな家計簿は Android アプリ（WebView）として入れてある。**
`kakeibo-pwa` の `android/` は TWA ではなく素の WebView アプリで、`AndroidManifest` に
https を受け取る intent-filter が無い。そのため https のリンクではアプリが起動せず
Chrome が開いてしまう。Android のときだけ `portal.js` が
`intent://open#Intent;scheme=kakeibo;package=com.tmhys.kakeibo;…;end` に差し替える。

**`MAIN` / `LAUNCHER` を指す `intent://` では起動しなかった。** Chrome は `intent://`
を発射するとき `BROWSABLE` カテゴリを必ず足し、Android は付いた全カテゴリを宣言して
いるアクティビティしか起動しないため。アプリ側に `VIEW` + `DEFAULT` + `BROWSABLE` で
`kakeibo://` を受ける intent-filter を足してある（`kakeibo-pwa` の `android/README.md`）。
**受け口のある APK（2026-11 以降のビルド）が要る。**

アプリが入っていない端末や古い APK は `browser_fallback_url` でウェブ版に落ち、
PC・iOS では差し替えずウェブ版のままにする。

**Claude Inbox だけ扱いが違う。** 本体は Cloudflare Workers で、ワーカーのホスト名は
どこにも公開していない。ここは公開リポジトリなので書かず、端末ごとにカードの
「設定する」から URL を入れる（`portal.js` が `portal:inboxUrl` に保存する）。
未設定の端末ではカードが「設定する」の表示になり、押しても開かない。

合言葉（`APP_TOKEN`）は Claude Inbox の画面側で入れるので、ここには保存しない。
`#t=...` 付きのURLを貼られても、保存時にハッシュを落とす。
`href` には `https:` のURLしか入れない（`javascript:` を弾くため）。

## モジュールの共通ルール

- **データの持ち方をモジュールごとに宣言する**（上の表）。混ぜない
  - 端末内だけのモジュール（ワークアウトログ）は、このリポジトリにもサーバーにも送らない
  - サーバーを使うモジュール（立替精算）は、**接続先を設定画面で入れる方式にする**。
    URLや合言葉をこのリポジトリに書かない。公開リポジトリなので置けば漏れる
- 端末内だけのモジュールは、設定画面から **JSONで書き出し／読み込み** ができること
  （バックアップと移行のため）。サーバー側が正本のモジュールは不要
- `localStorage` のキーは**モジュールごとの接頭辞**を付ける
  （`workoutLogPwa.`、`reimburse:`、`shopping:` など）。同じオリジンに別アプリが同居しているため
- 通知・リマインダーは付けない。必要ならバックエンド側（GAS）から送る

## 新しいツールの追加方法

1. リポジトリ直下にフォルダを作り、`index.html` 等を置く
2. ルートの `index.html` にカードを追加する
3. ルートの `sw.js` のキャッシュ対象にモジュールのファイルを追加し、`CACHE` の版を上げる
   （**版を上げ忘れると古いファイルが端末に残る**）
4. 上のモジュール表に「データの持ち方」を書く

## Android アプリ版（`android/`）

ワークアウトログだけ、WebView の Android アプリにしてある（`kakeibo-pwa` と同じ作り）。
中身は GitHub Pages の `workout/` をそのまま表示するので、**画面を直すときに
APK を作り直す必要はない**。APK を作り直すのは `android/` を変えたときだけ。

**記録はブラウザ（PWA）とアプリで別の場所に入る。** WebView の localStorage は
ブラウザのものと共有されない。移すときは、ブラウザ側で「JSONで書き出す」→
アプリ側で「JSONを読み込む」。どちらか一方に寄せること。

JSON の書き出しは、アプリの中では `window.WorkoutApp.saveFile` に渡す
（WebView では `a[download]` が効かないため）。詳しくは `android/README.md`。

## Service Worker について

**ネットワーク優先**。取れたものを控えに回し、圏外のときだけ控えを出す。
以前はキャッシュ優先だったため、更新を公開しても端末に届かなかった
（`kakeibo-pwa` は同じ理由で Service Worker を撤去している）。

自分のオリジン以外は素通しする。立替精算モジュールは GAS に `?month=...` を付けて
問い合わせるので、以前の `ignoreSearch: true` の照合だと別の月の応答を
取り違える恐れがあった。

### 買い物メモについて

画面の作りは `household-ordering` の発注リスト画面（`WebApp.gs`）に**合わせてある**。
タブも、カードに出す項目も、タブごとのボタンも同じ。どちらで操作しても同じことが
起きるようにするため、このモジュールに独自の操作を足さない。

LINE からの取り込み・Gemini での構造化・二重発注の判定・相場調べはすべて gas 側にある。
POST の宛先には `api=app` を付ける。これが無いと gas 側は LINE の webhook として扱い、
別の合言葉で弾かれる。

## ワークアウトログのルール

- 器具は腹筋ローラー・プッシュアップバー・ゴムチューブ（＋自重）のみ。**脚の種目は入れない**（マラソンのタイムを落とさないため）
- 週3回・1回30分、A（胸＋三頭）→ B（腕＋肩）→ C（胸＋腹）のローテーション。曜日固定なし
- 進行ルール：全セット目標クリア＆RPE7以下で次回 **+1回**（秒数の種目は **+5秒**）。RPE9以上か回数未達なら据え置き
- 各セッションで「脚の疲労感（1〜5）」と「次のランの感覚」を記録する
