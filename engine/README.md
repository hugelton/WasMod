# WasMod Engine Scaffold

`engine/src/wasmod_engine.cpp` は WasMod の最初の WebAssembly DSP 土台です。

- `vco-*` インスタンスに対して `Frequency` / `FineTune`
- `vca-*` インスタンスに対して `Level`
- `wasmod_process_block(...)` は `VCO -> VCA -> mono output` の最小オーディオチェーン

将来的にはここに、

- AudioWorklet から呼ばれる固定ブロック処理
- ジャック接続に対応した patch graph
- モジュールごとの DSP クラス分離

を足していく想定です。

## Build

Emscripten が入っている前提で:

```bash
./engine/build.sh
```

生成先:

```text
public/wasm/wasmod-engine.js
public/wasm/wasmod-engine.wasm
```
