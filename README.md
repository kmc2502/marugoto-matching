# まるごとマッチング

神山まるごと高専の学生同士をつなぐコミュニケーションアプリのプロトタイプです。

## 実装内容

- `@kamiyama.ac.jp` のみ通すログイン画面
- ホーム検索、通知一覧、自分のプロフィール、2x2機能アイコン
- プロフィール閲覧と本人のみ編集
- 学年・所属SPの「その他」自由記述
- 趣味・興味分野のハッシュタグ登録と検索
- 趣味・興味分野・所属プロジェクトのハッシュタグ一覧
- 話したい人登録、解除、相互登録時のマッチ表示
- あなたと話したい人、自分の話したい人リスト
- 閲覧履歴、足あと最新20件
- GitHub Pagesでそのまま公開できる静的構成

## 使い方

ブラウザで `index.html` を開きます。

デモログイン:

```text
aoi@kamiyama.ac.jp
```

別ユーザーで試す場合も、メールアドレスの末尾を `@kamiyama.ac.jp` にしてください。

## Firebase接続時の想定

現在はFirebase設定値なしで触れるよう、`localStorage` にデータを保存しています。本番化する場合は以下へ置き換える想定です。

- ログイン: Firebase Authentication の Google provider
- 利用制限: ログイン後のメールドメイン検証
- プロフィール: Firestore `profiles/{uid}`
- 話したい人: Firestore `wants/{from_to}`
- 通知: Firestore `notifications/{id}`
- 閲覧履歴・足あと: Firestore `visits/{id}`
