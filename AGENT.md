# WasMod Implementation Notes

## Core Direction

- WasMod is a lightweight browser modular system.
- DSP runs in `C++ -> Emscripten -> WASM -> AudioWorklet`.
- UI modules are authored as SVG and bound through class names and `data-*` attributes.

## Rack And UI Rules

- Rack geometry uses Eurorack units.
- `1HP = 5.08mm`.
- Module SVGs use `mm` coordinates in their internal `viewBox` and placement math.
- Rack width is currently `60HP`.
- Rack rows stay fixed-height and stack continuously with no visible gap between adjacent rails.
- The rack should fit the viewport width; scale the rack unit, not the surrounding UI typography.

## Module Authoring Rules

- Store modules as separate units.
- Use `modules/<maker>/<module>/` as the long-term source layout target.
- Each module should carry a metadata file such as `module.yml`.
- Minimum metadata should include:
  - `maker`
  - `author`
  - `name`
  - `version`
  - `type`
  - `description`
  - `url`
  - `hp`
- SVG modules should expose controls and jacks with WasMod classes like:
  - `wm__knob`
  - `wm__fader`
  - `wm__button`
  - `wm__input`
  - `wm__output`
  - `wm__led`

## Interaction Rules

- Module move uses left-button drag only.
- Middle mouse must never move modules.
- Context menus must render in the topmost app overlay layer, not inside module DOM.
- Selecting a module uses a flat red outline, not glow.
- Dragging a module or cable must not also trigger module click/context actions.

## Cable Rules

- Cables are drawn above the rack and modules.
- Cable colors should rotate through a fixed palette automatically.
- Cables should feel visually substantial, not hairline-thin.

## Audio Rules

- Audio start must be user-triggered with a Play button because of browser autoplay policy.
- Header transport should expose:
  - `Play`
  - `Stop`
  - `Master volume`
  - `green/yellow/red` output indicators
- The frontend should prefer the real WASM engine when available and fall back to mock only when needed.

## Current Test Modules

- `Junction`: 4HP passive multiple with six vertically centered jacks at `17.78mm` pitch.
- `Sine VCO`: minimal 4HP oscillator with `Pitch`, `cv_in`, and `audio_out`.
