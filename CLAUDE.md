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

## 商業レベル改善計画（進行中）

**目標**: プロトタイプからベータ版として公開可能な商業品質への向上

**進捗**: フェーズ1.1完了、フェーズ1.2-4.2未着手

### フェーズ1: アーキテクチャの根本改善 ✅ 1.1完了、1.2-1.4未着手

#### ✅ 1.1 コンポーネントの分割と再構築（完了）
App.svelte（1,203行 → 608行、50%削減）を以下のコンポーネントに分割：
- `src/lib/components/layout/TopBar.svelte` - トランスポートとメーター
- `src/lib/components/layout/RackContainer.svelte` - ラック、キャンバス、最小限
- `src/lib/components/layout/ModulePalette.svelte` - モジュールパレット
- `src/lib/components/layout/SelectionManager.svelte` - 選択カードとアクション

**成果**: 単一責任の原則を適用、メンテナンス性向上

#### ⏳ 1.2 構造化された状態管理（未着手）
**目的**: 分散した状態を統一し、予測可能なデータフローを実現

**実装内容**:
- Svelte storesを作成：
  - `src/lib/stores/RackStore.ts` - モジュール、ケーブル、配置
  - `src/lib/stores/AudioStore.ts` - エンジン状態、パラメータ、診断
  - `src/lib/stores/SelectionStore.ts` - 選択、コンテキストメニュー
  - `src/lib/stores/UIStore.ts` - パレット、スクロール、最小限

**変更するファイル**:
- 作成: `src/lib/stores/*.ts`
- 変更: `src/App.svelte`（ストアを使用）
- 変更: `src/lib/components/*.svelte`（ストアをサブスクライブ）

**成功の基準**:
- 状態が中央集権化されている
- コンポーネント間の通信がストア経由
- リアクティブな更新が正常に動作

#### ⏳ 1.3 イベントハンドリングの再設計（未着手）
**目的**: SVGコントロールとモジュールドラッグの競合を解消

**実装内容**:
- キャプチャーフェーズのイベントリスナーを廃止
- CSS `pointer-events` を活用：
  - SVGのコントロール要素のみ `pointer-events: auto`
  - SVGの背景要素は `pointer-events: none`
  - モジュールドラッグは明示的なドラッグ領域で実行

**変更するファイル**:
- 変更: `src/lib/actions/autoBindModule.ts`（イベントハンドリングを簡素化）
- 変更: `src/lib/components/RackCanvas.svelte`（ドラッグ検出を改善）
- 変更: `src/lib/modules/*.svelte`（pointer-events CSSを追加）

**成功の基準**:
- ノブ操作でモジュールが動かない
- コンテキストメニューが右クリックで正常に動作
- イベントハンドリングが簡潔で理解しやすい

#### ⏳ 1.4 エラーハンドリングの導入（未着手）
**目的**: 包括的なエラー管理とユーザーフィードバック

**実装内容**:
- エラーバウンダリーとエラーマネージャーを実装：
  - `src/lib/core/ErrorManager.ts` - エラーの分類、ロギング、通知
  - `src/lib/components/ErrorBoundary.svelte` - エラーキャッチとUI表示

**変更するファイル**:
- 作成: `src/lib/core/ErrorManager.ts`
- 作成: `src/lib/components/ErrorBoundary.svelte`
- 変更: すべての主要コンポーネント（エラーハンドリングを追加）

**成功の基準**:
- エラーが適切にキャッチされる
- ユーザーにわかりやすいエラーメッセージが表示される
- エラーがコンソールに詳細にログされる

### フェーズ2: オーディオエンジンの安定化（未着手）

#### ⏳ 2.1 オーディオ初期化の強化
**目的**: オーディオエンジンの確実な初期化とエラー回復

**実装内容**:
- `src/lib/engine/createEngine.ts`の強化：
  - 詳細なエラーレポーティング
  - リトライロジック
  - フォールバック戦略の明確化
- Worklet初期化の同期改善
- パラメータ初期化のタイミング修正

**成功の基準**:
- 音が確実に出る
- 初期化エラーが適切に報告される
- モックエンジンへのフォールバックが動作する

#### ⏳ 2.2 パフォーマンス監視の追加
**目的**: リアルタイムパフォーマンスメトリクス

**実装内容**:
- CPU使用率、メモリ使用量、オーディオレイテンシの追跡
- 診断情報のUI表示
- パフォーマンス警告システム

**成功の基準**:
- CPU/メモリ使用量が表示される
- パフォーマンス問題が警告される
- メトリクスが開発者ツールで確認できる

### フェーズ3: テストフレームワークの導入（未着手）

#### ⏳ 3.1 テスト環境の構築
**目的**: 自動テストと回帰テストの基盤

**実装内容**:
- VitestまたはJestの設定
- テストユーティリティの作成
- モックエンジンの強化
- カバレッジレポートの設定

#### ⏳ 3.2 コア機能のテスト
**目的**: 重要な機能のテストカバレッジ

**実装内容**:
- 状態管理のテスト
- モジュール配置/移動/削除のテスト
- ケーブル接続/切断のテスト
- エンジン初期化のテスト

**成功の基準**:
- 主要な機能がテストされている
- カバレッジが60%以上
- 回帰テストが自動実行される

### フェーズ4: ベータ版公開の準備（未着手）

#### ⏳ 4.1 ドキュメントの整備
**目的**: ユーザーと開発者のためのドキュメント

**実装内容**:
- ユーザーマニュアルの作成
- 開発者ガイドの拡張
- APIドキュメントの作成
- 既知の問題のドキュメント化

#### ⏳ 4.2 リリースプロセスの確立
**目的**: ベータ版の配布とフィードバック収集

**実装内容**:
- バージョニング戦略の策定
- リリースノートの作成
- フィードバック収集の仕組み
- GitHub Issuesのテンプレート作成

## コンポーネント構造（フェーズ1.1完了後の現在の状態）

```
src/lib/components/
├── layout/           # NEW: レイアウトコンポーネント
│   ├── TopBar.svelte           # トランスポートとメーター
│   ├── RackContainer.svelte   # キャンバス、最小限、ラックヒント
│   ├── ModulePalette.svelte    # モジュールパレット
│   └── SelectionManager.svelte # 選択カードとアクション
├── ModuleRenderer.svelte         # モジュールSVGレンダリング
├── RackCanvas.svelte             # ラック描画、モジュール移動、結線UI
└── ErrorBoundary.svelte          # TODO: エラーバウンダリー
```

## 状態管理の現在の問題点（フェーズ1.2で対応予定）

**現在のアプローチ**: App.svelte（608行）に状態が分散
- モジュール、ケーブル、選択状態がローカル変数
- エンジン、オーディオ状態が混在
- UI状態（パレット、スクロール）が含まれる

**問題点**:
1. コンポーネント間の通信がprops/eventsで複雑
2. 状態更新のロジックが分散して追跡困難
3. テストが困難（モックが必要）
4. 新機能追加時に複数のコンポーネントを変更する必要

**フェーズ1.2完了後の目標**:
```typescript
// stores/RackStore.ts - モジュールとケーブルの一元管理
export const rackStore = createRackStore();
// 使用: rackStore.addModule(), rackStore.connectCables()

// stores/AudioStore.ts - エンジン状態の一元管理
export const audioStore = createAudioStore();
// 使用: audioStore.start(), audioStore.setParameter()

// stores/SelectionStore.ts - 選択状態の一元管理
export const selectionStore = createSelectionStore();
// 使用: selectionStore.selectModule(), selectionStore.clear()
```

## 残りの作業の見積もり

- **フェーズ1.2（状態管理）**: 1-2週間
- **フェーズ1.3（イベント再設計）**: 3-5日
- **フェーズ1.4（エラーハンドリング）**: 1週間
- **フェーズ2（オーディオ安定化）**: 1-2週間
- **フェーズ3（テスト導入）**: 1-2週間
- **フェーズ4（ベータ準備）**: 1週間

**合計**: 約6-9週間でベータ版公開可能な状態を目指す

## 優先順位（ユーザー選択）

ユーザーは**アーキテクチャの根本改善**を最優先として選択：

1. ✅ **コンポーネント分割**（完了）
2. ⏳ **構造化された状態管理**（次）
3. ⏳ **イベントハンドリングの再設計**
4. ⏳ **エラーハンドリングの導入**

その後、オーディオ安定化 → テスト導入 → ベータ準備の順番で実施。

## 参考資料

詳細な計画と実装手順は以下を参照：
- 計画ファイル: `~/.claude/plans/wild-floating-bunny.md`
- バックアップ: `src/App.svelte.backup`（リファクタリング前の状態）

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
