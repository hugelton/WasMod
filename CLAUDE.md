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

### 3. SVG属性ベース・バインディングシステム

モジュールは1枚のSVGとして設計し、特定のクラスと属性で機能を結び付けます：

**コントロールクラス**:
- `wm__knob` - 回転ノブ
- `wm__fader` - フェーダー
- `wm__button` - モーメンタリ/トグルボタン
- `wm__led_button` - LED内蔵ボタン
- `wm__input` - 入力ジャック
- `wm__output` - 出力ジャック
- `wm__led` - ステータスLED

**重要な属性**:
- `data-name` - DSPパラメータ名/ジャック名
- `data-min`, `data-max` - 値レンジまたは電圧レンジ
- `data-value` - 初期値
- `data-bias` - ノーマリング用デフォルト電圧
- `data-type` - `momentary` / `toggle`（ボタン用）

## ラックとモジュールの幾何学

- **基本単位**: `1HP = 5.08mm`
- **ラック幅**: `84HP`（`RACK_TOTAL_HP`定数）
- **座標系**: モジュールSVGは内部`viewBox`でmm座標を使用
- **ラック行**: 固定高さ、隣接するレール間に視覚的ギャップなし

### 重要な制約とルール

**モジュール操作**:
- モジュールドラッグは左ボタンのみ
- 中ボタンはモジュールを移動しない
- コンテキストメニューは**右クリック**で表示（長押しではない）
- ノブ/フェーダー操作中はモジュールドラッグを無効化する必要あり

**ケーブルルール**:
- ケーブルはラックとモジュールの上に描画
- ケーブル色は固定パレットを自動ローテーション
- ケーブル状態はトップレベルアプリ状態に所属
- モジュール削除時は接続されたケーブルも削除
- 入力-入力、出力-出力の接続は無効

**オーディオルール**:
- ブラウザの自動再生ポリシーにより、オーディオ開始はユーザートリガー（Playボタン）が必要
- ヘッダートランスポートは以下を公開：
  - `Play` / `Stop`ボタン
  - `Master volume`スライダー
  - `green/yellow/red`出力インジケーター

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

## 重要な実装詳細

### エンジン初期化順序（重要）
`App.svelte`の`onMount`で：
1. **先に**エンジンを作成：`await createWasmodEngine()`
2. **その後**でモジュールを追加：`addModuleAt()`

この順序を逆にすると、初期パラメータがエンジンに送信されません。

### SVGイベントハンドリング
`autoBindModule.ts`でコントロールをバインド：
- キャプチャーフェーズでイベントを取得
- グローバルフラグ`activeControlPointerId`でコントロール操作中を追跡
- `RackCanvas.beginModuleDrag`でフラグをチェックしてモジュールドラッグを防止

### WASMエンジンとの通信
`public/wasm/wasmod-engine.js`で：
- `ensureAudio()`でAudioWorkletを初期化
- workletの準備完了を待ってからメッセージを送信
- `setParameter`, `connect`, `disconnect`メッセージをworkletに転送

`public/wasm/wasmod-worklet.js`で：
- C++エンジン関数を`ccall`で呼び出し
- WASMヒープ上のオーディオバッファを処理
- メーターデータをメインスレッドに送信

## 既知の問題と制約

### 現在のDSP制約
- DSPは最小検証用で、`Speaker`への接続数のみを見て音を開閉
- `Junction`はUI/結線テスト用で、まだ受動マルチの信号分配DSPはない
- 本格的なモジュール投稿モデルはまだ実装されていない

### SVGイベントハンドリングの課題
- SVG要素の`stopPropagation()`が期待通り動作しない場合がある
- キャプチャーフェーズのイベントリスナーとSvelteのイベント競合
- コントロール操作中にモジュールドラッグが誤って発火する可能性あり

### オーディオ初期化の同期
- worklet初期化のタイミングでメッセージが失われる可能性
- `ensureAudio()`のPromise解決を待つ実装が必要
- 初期パラメータ送信のタイミングが重要

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
