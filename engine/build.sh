#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/public/wasm"
mkdir -p "$OUT_DIR"

emcc \
  "$ROOT_DIR/engine/src/wasmod_engine.cpp" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_wasmod_create_engine","_wasmod_destroy_engine","_wasmod_set_parameter","_wasmod_connect","_wasmod_set_sample_rate","_wasmod_process_block"]' \
  -o "$OUT_DIR/wasmod-core.js"

echo "Built $OUT_DIR/wasmod-core.js"
