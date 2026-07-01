# 夜道明るさ記録マップ

iPhoneなどのスマートフォンブラウザで、カメラ画像から推定した夜道の明るさと位置情報を記録するWebアプリです。記録した地点は5段階の色で地図に表示でき、CSVとして出力できます。

## 実装内容

- カメラプレビューから `0.299R + 0.587G + 0.114B` で平均明るさを算出
- 明るさを5段階に分類
- 位置情報、精度、取得時刻を記録
- 記録間隔を1秒、2秒、3秒から選択
- 記録履歴を端末の `localStorage` に保存
- Leaflet と OpenStreetMap による地図表示
- 地点タップ時の詳細表示
- CSV出力
- 利用可能なブラウザでは `AmbientLightSensor` の値も保存
- iPhone向けのPWA設定、ホーム画面アイコン、HTTPSチェック
- GitHub Pagesへの自動公開ワークフロー

## iPhoneで使う方法

iPhoneでカメラと位置情報を使うには、アプリをHTTPSのURLで開く必要があります。GitHub Pagesで公開するとSafariからそのまま利用できます。

1. このリポジトリをGitHubへpushします。
2. GitHubのリポジトリ画面で `Settings` → `Pages` を開きます。
3. `Build and deployment` の `Source` を `GitHub Actions` にします。
4. `Actions` の `Deploy to GitHub Pages` が成功するまで待ちます。
5. 表示されたPages URLをiPhone Safariで開きます。
6. `記録開始` を押し、カメラと位置情報を許可します。

このリポジトリ名のまま公開する場合、URLは次の形式になります。

```text
https://kmc2502.github.io/marugoto-matching/
```

Safariで開いたあと、共有ボタンから `ホーム画面に追加` を選ぶとアプリのように起動できます。

## 開発中の確認

PCのブラウザで見た目を確認する場合は、以下のローカルサーバーを使えます。

```bash
python3 -m http.server 4173
```

その後、ブラウザで `http://127.0.0.1:4173/` を開きます。

同じWi-Fi内のiPhoneから `http://PCのIPアドレス:4173/` を開いても、iPhone Safariではカメラが使えない場合があります。実機で記録する最終確認はHTTPSの公開URLで行ってください。

## CSV形式

```csv
time,latitude,longitude,accuracy,brightness,level,light_sensor
2026-07-01 20:15:03,34.000000,134.000000,8,52,2,
```

## 注意

このアプリの明るさはluxではなく、カメラ画像から求めた相対的な値です。スマートフォンの自動露出や撮影方向の影響を受けるため、同じ端末、同じ向き、同じ時間帯で記録すると比較しやすくなります。
