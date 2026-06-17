# WasMod

A lightweight modular synth environment that runs C++ DSP via WebAssembly in the browser.

## Core

- No installation required: instant-start web modular synth
- C++ DSP compiled to WASM via Emscripten, running on AudioWorklet
- Extreme simplicity for UI/DSP division: SVG attributes auto‑bind controls

## Current Prototype

This repository contains an early prototype that brings rack editing and minimal audio playback together.

- Svelte + Vite frontend
- 60HP Eurorack‑style rack
- SVG module placement, movement, selection
- Minimal patch cables between jacks
- Cables follow module drag while patching
- Cable state stored at the app level
- AudioWorklet + WASM minimal signal path
- Header transport: Play / Stop / Master / three‑color meter
- Test modules: Junction, Sine VCO, Speaker

## SVG Attributes Auto‑Detection System

Each module is a single SVG; the frontend scans for specific classes and data‑* attributes to bind functionality.

- `wm__knob`: rotary knob
- `wm__fader`: fader
- `wm__button`: momentary / toggle button
- `wm__led_button`: LED‑lit button
- `wm__input`: input jack
- `wm__output`: output jack
- `wm__led`: status LED

Common attributes:

- `data-name`: DSP parameter name / jack name
- `data-min`, `data-max`: value or voltage range
- `data-value`: initial value
- `data-bias`: default voltage for normaling
- `data-type`: `momentary` / `toggle` (for buttons)

## Minimal Model

Current minimal modules:

- **Junction**
  - 4HP
  - 6 jacks
  - 17.78mm pitch
  - Passive multiple UI test

- **Sine VCO**
  - 4HP
  - Pitch knob
  - cv_in
  - audio_out
  - Minimal WASM sine‑wave source

- **Speaker**
  - 4HP
  - audio_in
  - Minimal output sink for audio check

### Minimal sound‑out steps

1. Place a `Sine VCO`
2. Place a `Speaker`
3. Patch `VCO OUT → Speaker IN`
4. Press the header **Play** button
5. Adjust Pitch and Master

## Project Structure

```
text
src/
  lib/
    actions/       SVG auto‑binding logic
    components/    Rack and layout UI
    engine/        Frontend‑engine bridge
    modules/       Separate SVG module files
engine/
  src/             C++ DSP scaffold for WASM
docs/
  wasmod-ui-mockup.html
```

### Frontend responsibilities

- `App.svelte` – holds module array, cable array, selection state, audio engine
- `RackCanvas.svelte` – rack drawing, module movement, connection UI
- `autoBindModule.ts` – scans SVG `wm__*` classes to bind knobs, buttons, etc.

### Future module contribution layout (planned)

```
text
modules/
  <maker>/
    <module>/
      module.yml   # metadata
      ui.svg       # SVG UI
      dsp.cpp      # DSP implementation
      dsp.h        # DSP header
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

## Deployment

### GitHub Pages (Auto Deploy)

Push to GitHub repository to automatically deploy to GitHub Pages:

1. Set "Source" to "GitHub Actions" in repository Settings → Pages
2. Just push to `main` branch for auto-deploy
3. Access at `https://<username>.github.io/WasMod/`

### Vercel (Manual Deploy)

```bash
npm run build
vercel --prod
```

### Netlify (Manual Deploy)

```bash
npm run build
netlify deploy --prod --dir=dist
```

### WebAssembly Engine Scaffold

If no WASM binary exists, the frontend falls back to a mock backend.

With Emscripten installed:

```bash
./engine/build.sh
```

When `public/wasm/wasmod-engine.js` is present, the frontend prefers that loader.

## Current Constraints

- DSP is currently minimal: audio toggles based only on Speaker connection count
- Junction is UI/cable‑test only; no passive‑multiple DSP yet
- Full module‑posting model (`modules/<maker>/<module>/module.yml`) is upcoming

## License

MIT License - See LICENSE file for details
