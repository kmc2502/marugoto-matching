# まるごとマッチング

神山まるごと高専の学生同士をつなぐコミュニケーションアプリです。Supabase Auth と Supabase Database を前提にしています。

## 実装内容

- `@kamiyama.ac.jp` を含むメールアドレスだけ送信できるログイン画面
- ホーム検索、通知一覧、自分のプロフィール、2x2機能アイコン
- プロフィール閲覧と本人のみ編集
- 学年・所属SPの「その他」自由記述
- 趣味・興味分野のハッシュタグ登録と検索
- 趣味・興味分野・所属プロジェクトのハッシュタグ一覧
- 話したい人登録、解除、相互登録時のマッチ表示
- 趣味・興味分野の一致数で並ぶおすすめ人物リスト
- あなたと話したい人、自分の話したい人リスト
- 閲覧履歴、足あと最新20件
- GitHub Pagesでそのまま公開できる静的構成
- Supabase の `profiles / want_links / notifications / profile_visits` テーブル利用

## 使い方

ブラウザで `index.html` を開きます。

1. [supabase-schema.sql](/Users/aokichizuru/Documents/New%20project/supabase-schema.sql) を Supabase SQL Editor で実行します。
2. [supabase-config.js](/Users/aokichizuru/Documents/New%20project/supabase-config.js) に `url` と `anonKey` を入れます。
3. ログイン画面で `@kamiyama.ac.jp` を含むメールアドレスを入力すると、Supabase からログインリンクが送られます。

## 補足

- フロントのログイン制限はメールアドレス文字列に `@kamiyama.ac.jp` が含まれているかで判定しています。
- DB 側でも `profiles.email` に同じドメイン制約を入れています。
- アイコン画像は現状 Base64 文字列として `profiles.photo_url` に保存しています。運用時は Supabase Storage へ移すと安定します。
