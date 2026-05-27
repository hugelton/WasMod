# WasMod

VCV Rack よりも軽く、C++ で書かれた DSP を Web ブラウザ上で動かせるモジュラーシンセサイザー環境です。

WasMod の核は 3 つです。

- インストール不要で即起動できる、超軽量な Web モジュラーであること
- C++ DSP を Emscripten 経由で WASM 化し、AudioWorklet 上で鳴らすこと
- UI デザイナーと DSP エンジニアの分業を、SVG 属性ベースで極限までシンプルにすること

## Current Prototype

このリポジトリの現状は、ラック編集と最小音声再生まで通した初期プロトタイプです。

- `Svelte + Vite` ベースのフロントエンド
- `60HP` 幅の Eurorack 風ラック
- SVG モジュールの配置、移動、選択
- ジャック間の最小パッチケーブル
- モジュール移動中も追従するケーブル描画
- ケーブル状態はアプリ上位で保持
- `AudioWorklet + WASM` による最小再生経路
- ヘッダーの `Play / Stop / Master / 3色メーター`
- テスト用 `Junction`、`Sine VCO`、`Speaker`

## SVG Attributes Auto-Detection System

各モジュールは 1 枚の SVG として設計し、フロントエンドは特定のクラスと属性をスキャンして機能を結び付けます。

- `wm__knob`: 回転ノブ
- `wm__fader`: フェーダー
- `wm__button`: モーメンタリ / トグルボタン
- `wm__led_button`: LED 内蔵ボタン
- `wm__input`: 入力ジャック
- `wm__output`: 出力ジャック
- `wm__led`: ステータス LED

代表的な属性:

- `data-name`: DSP パラメータ名 / ジャック名
- `data-min`, `data-max`: 値レンジまたは電圧レンジ
- `data-value`: 初期値
- `data-bias`: ノーマリング用デフォルト電圧
- `data-type`: `momentary` / `toggle`

## Minimal Model

現在の最小モデルは次の考え方です。

- `Junction`
  - 4HP
  - 6 ジャック
  - `17.78mm` ピッチ
  - 受動マルチプルの UI テスト用
- `Sine VCO`
  - 4HP
  - `Pitch` ノブ
  - `cv_in`
  - `audio_out`
  - WASM でサイン波を生成する最小音源
- `Speaker`
  - 4HP
  - `audio_in`
  - 出音確認用の最小出力モジュール

最小の音出し手順:

1. `Sine VCO` を置く
2. `Speaker` を置く
3. `VCO OUT -> Speaker IN` を結線する
4. ヘッダーの `Play` を押す
5. `Pitch` と `Master` を調整する

## Project Structure

```text
src/
  lib/
    actions/       SVG auto-binding logic
    components/    Rack and layout UI
    engine/        Frontend engine bridge
    modules/       Separate SVG module files
engine/
  src/             C++ DSP scaffold for WASM
docs/
  wasmod-ui-mockup.html
```

現時点のフロントエンド責務:

- `App.svelte`
  - モジュール配列、ケーブル配列、選択状態、オーディオエンジンを保持
- `RackCanvas.svelte`
  - ラック描画、モジュール移動、結線 UI を担当
- `autoBindModule.ts`
  - SVG の `wm__*` をスキャンしてノブやボタンを結び付ける

将来的なモジュール投稿構造の想定:

```text
modules/
  <maker>/
    <module>/
      module.yml
      ui.svg
      dsp.cpp
      dsp.h
```

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## WebAssembly Engine Scaffold

WASM 生成物がまだ無い場合、フロントエンドは mock backend で起動します。

Emscripten がある環境なら:

```bash
./engine/build.sh
```

生成された `public/wasm/wasmod-engine.js` が存在すれば、フロントエンドはそちらのローダーを優先して使います。

## Current Constraints

- いまの DSP は最小検証用で、`Speaker` への接続数だけを見て音を開閉しています
- `Junction` は UI/結線テスト用で、まだ受動マルチの信号分配 DSP はありません
- 本格的なモジュール投稿モデル `modules/<maker>/<module>/module.yml` はまだこれからです
