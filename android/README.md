# 筋トレログ（Android）

マイツールの **ワークアウトログ**（`https://tmhys.github.io/my-apps/workout/`）を
表示する Android アプリ。`kakeibo-pwa` の `android/` と同じ作り。

**画面の中身は Web のまま**で、ネイティブで受け持つのは次だけ:

| 何を | なぜアプリ側でやるか |
|---|---|
| 戻るボタン | 戻れるあいだは画面の中で戻り、ホームでもう一度押すと閉じる |
| 下に引っぱって更新 | ページを読み直す（一番上にいるときだけ） |
| JSON の書き出し | WebView はブラウザと同じ方法ではファイルを保存できないので、保存先を選ぶ画面に渡す |
| ファイルの読み込み | バックアップの JSON を選ぶ |
| 読み込めなかったとき | URL の確認・変更と再読み込みの画面 |

画面を直すときは `workout/` の `index.html`・`app.js`・`styles.css` を直せばよい。
**APK を作り直す必要はない**（アプリは毎回 GitHub Pages を読む）。
APK を作り直すのは `android/` を変えたときだけ（`.github/workflows/android.yml`）。

## 記録は引き継がれない

**アプリの記録とブラウザ（PWA）の記録は別の場所に入る。** WebView の
localStorage はブラウザのものと共有されないため。移すときはこの順で行う。

1. ブラウザでワークアウトログを開き、設定 →「JSONで書き出す」
2. アプリを入れて開き、設定 →「JSONを読み込む」

両方を使い続けると記録が分かれていくので、**どちらか一方に寄せる**こと。

## 入れ方

1. GitHub の **Releases** の「筋トレログ（最新ビルド）」（`android-latest`）から
   `workout.apk` を落として入れる。更新を自動で追うなら Obtainium に
   このリポジトリ（`tmhys/my-apps`）を足す
2. 上の手順で記録を移す

## アイコン

`app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`（192×192）。
**元になった図は `android/icon.svg`。** 直すときはそちらを直して 192×192 で
書き出す（`values/colors.xml` と同じ配色）。

`res/` の直下には置かない。AAPT はリソースの型ごとのディレクトリ
（`drawable/`・`mipmap-*/` など）の中しか見ないので、直下にファイルがあると
ビルドが落ちる。

家計簿アプリと同じ型（アクセント色の地にクリーム色の丸、中に記号）にしてある。
ホーム画面に並んだときに同じ家のアプリだと分かるため。中身はダンベル。

## 署名鍵

鍵ファイル（base64）を Secrets の `WORKOUT_KEYSTORE_B64`、パスワードを
`WORKOUT_KEYSTORE_PASSWORD` に置く（エイリアスは `workout`）。鍵はリポジトリに置かない。
無いと debug 鍵でビルドされ、更新のたびにアンインストールが要る。
鍵をなくすと以後の APK は上書きインストールできなくなるので、控えを残しておくこと。

## ブラウザから開く（`workout://`）

マイツールのポータルのカードから、Android ではこのアプリを起動する。
Chrome は `intent://` に `BROWSABLE` を必ず足し、Android は付いた全カテゴリを
宣言しているアクティビティしか起動しないので、`VIEW` + `DEFAULT` + `BROWSABLE` で
`workout://` を受ける intent-filter を置いてある（`kakeibo-pwa` と同じ理由）。
