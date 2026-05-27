# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

```bash
# フロントエンド開発サーバー起動
npm run dev

# 型チェック
npm run check

# 本番ビルド
npm run build

# WASMエンジンビルド（Emscriptenが必要）
./engine/build.sh
```

WASMエンジンがビルドされていない場合、フロントエンドは自動的にモックバックエンドを使用します。

## プロジェクトアーキテクチャ

WasModは3つの主要なレイヤーで構成されます：

### 1. フロントエンド（Svelte + Vite）
- `src/App.svelte` - メインアプリケーション状態（モジュール、ケーブル、選択、エンジン）を保持
- `src/lib/components/RackCanvas.svelte` - ラック描画、モジュール移動、結線UIを担当
- `src/lib/components/ModuleRenderer.svelte` - モジュールSVGのレンダリング
- `src/lib/actions/autoBindModule.ts` - SVG属性ベースのコントロール自動バインディング

### 2. WASM DSPエンジン（C++ + Emscripten）
- `engine/src/wasmod_engine.cpp` - WebAssembly DSP土座
- AudioWorklet上で実行
- 現在は最小検証用（VCO→Speakerの最小チェーン）

### 3. モジュールシステム
- SVGベースのモジュールUI
- `data-*`属性とクラス名で機能を自動検出
- 将来的には`modules/<maker>/<module>/`構造で拡張予定

## SVG属性ベース・バインディングシステム

モジュールは1枚のSVGとして設計し、特定のクラスと属性で機能を結び付けます：

### コントロールクラス
- `wm__knob` - 回転ノブ
- `wm__fader` - フェーダー
- `wm__button` - モーメンタリ/トグルボタン
- `wm__led_button` - LED内蔵ボタン
- `wm__input` - 入力ジャック
- `wm__output` - 出力ジャック
- `wm__led` - ステータスLED

### 重要な属性
- `data-name` - DSPパラメータ名/ジャック名
- `data-min`, `data-max` - 値レンジまたは電圧レンジ
- `data-value` - 初期値
- `data-bias` - ノーマリング用デフォルト電圧
- `data-type` - `momentary` / `toggle`（ボタン用）

バインディングロジックは`autoBindModule.ts`を参照してください。

## ラックとモジュールの幾何学

- **基本単位**: `1HP = 5.08mm`
- **ラック幅**: `84HP`（`RACK_TOTAL_HP`定数）
- **座標系**: モジュールSVGは内部`viewBox`でmm座標を使用
- **ラック行**: 固定高さ、隣接するレール間に視覚的ギャップなし
- **スケーリング**: ラック単位をスケールしてビューポート幅に適合（周囲UIのタイポグラフィはスケールしない）

### 配置ルール
- モジュールは左ボタンドラッグのみで移動
- 中ボタンはモジュールを移動しない
- モジュール選択はフラットな赤いアウトライン（グローではない）
- コンテキストメニューは最上位アプリオーバーレイレイヤーに描画
- モジュール/ケーブルドラッグ時はクリック/コンテキストアクションを発火しない

## ケーブルルール

- ケーブルはラックとモジュールの上に描画
- ケーブル色は固定パレットを自動ローテーション
- ケーブルは視覚的に太く、毛線のように細くしない
- ケーブル状態はトップレベルアプリ状態に所属（`RackCanvas`のみではない）
- モジュール削除時は接続されたケーブルも削除
- 既存ケーブルはモジュールドラッグプレビューを視覚的に追従
- 入力-入力、出力-出力の接続は無効（片方が`both`の場合を除く）

## オーディオルール

- ブラウザの自動再生ポリシーにより、オーディオ開始はユーザートリガー（Playボタン）が必要
- ヘッダートランスポートは以下を公開：
  - `Play` / `Stop`ボタン
  - `Master volume`スライダー
  - `green/yellow/red`出力インジケーター
- 利用可能な場合、リアルWASMエンジンを優先、必要時のみモックにフォールバック
- 接続/切断動作は対称的で、パッチ編集が古いオーディオルートを残さない

## 現在のテストモジュール

- **Junction**: 4HP受動マルチプル、6つのジャックを`17.78mm`ピッチで垂直中央配置
- **Sine VCO**: 最小4HPオシレーター、`Pitch`ノブ、`cv_in`、`audio_out`
- **Speaker**: 最小4HPモノ出力シンク、`audio_in`

最小音出し手順：
1. `Sine VCO`を配置
2. `Speaker`を配置
3. `VCO OUT → Speaker IN`を結線
4. ヘッダーの`Play`を押す
5. `Pitch`と`Master`を調整

## 型システム

主要な型は`src/lib/types.ts`で定義：

- `ModuleKind` - モジュール種別のユニオン型
- `RackModuleInstance` - ラック上のモジュールインスタンス
- `CableEndpoint` - ケーブルの端点（モジュールID + ジャック名 + ロール）
- `PatchCable` - パッチケーブル
- `WasmodEngine` - オーディオエンジンインターフェース

## 将来的なモジュール投稿構造

```
modules/
  <maker>/
    <module>/
      module.yml  # メタデータ
      ui.svg      # SVG UI
      dsp.cpp     # DSP実装
      dsp.h       # DSPヘッダー
```

メタデータの最小項目：
- `maker`, `author`, `name`, `version`, `type`, `description`, `url`, `hp`

## 重要な制約

- 現在のDSPは最小検証用で、`Speaker`への接続数のみを見て音を開閉
- `Junction`はUI/結線テスト用で、まだ受動マルチの信号分配DSPはない
- 本格的なモジュール投稿モデルはまだ実装されていない
- WASMエンジンは`speaker-*`への結線数で音の出し分けのみを行っている

## エンジン拡張の指針

WASMエンジンを拡張する際：
- AudioWorkletから呼ばれる固定ブロック処理を追加
- ジャック接続に対応したパッチグラフを実装
- モジュールごとのDSPクラス分離
- 現在の`engine/src/wasmod_engine.cpp`は土座で、将来的には本格的なグラフ処理に拡張予定
