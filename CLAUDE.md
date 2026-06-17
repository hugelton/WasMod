# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start frontend development server
npm run dev

# Type checking
npm run check

# Production build
npm run build

# Build WASM engine (requires Emscripten)
./engine/build.sh
```

If the WASM engine is not built, the frontend will automatically use a mock backend.

## Project Architecture

WasMod consists of three main layers:

### 1. Frontend (Svelte + Vite)
- `src/App.svelte` - Holds main application state (modules, cables, selection, engine)
- `src/lib/components/RackCanvas.svelte` - Handles rack drawing, module movement, and patching UI
- `src/lib/components/ModuleRenderer.svelte` - Renders module SVGs
- `src/lib/actions/autoBindModule.ts` - SVG attribute-based automatic control binding

### 2. WASM DSP Engine (C++ + Emscripten)
- `engine/src/wasmod_engine.cpp` - WebAssembly DSP foundation
- Runs on AudioWorklet
- Currently minimal for verification (VCO→Speaker minimal chain)

### 3. SVG Attribute-Based Binding System

Modules are designed as single SVG files, with functionality bound through specific classes and attributes:

**Control Classes**:
- `wm__knob` - Rotary knob
- `wm__fader` - Fader
- `wm__button` - Momentary/toggle button
- `wm__led_button` - LED-integrated button
- `wm__input` - Input jack
- `wm__output` - Output jack
- `wm__led` - Status LED

**Important Attributes**:
- `data-name` - DSP parameter name/jack name
- `data-min`, `data-max` - Value range or voltage range
- `data-value` - Initial value
- `data-bias` - Default voltage for normaling
- `data-type` - `momentary` / `toggle` (for buttons)

## Rack and Module Geometry

- **Base Unit**: `1HP = 5.08mm`
- **Rack Width**: `84HP` (`RACK_TOTAL_HP` constant)
- **Coordinate System**: Module SVGs use mm coordinates in internal `viewBox`
- **Rack Rows**: Fixed height, no visual gap between adjacent rails

### Important Constraints and Rules

**Module Operations**:
- Module drag uses left button only
- Middle button does not move modules
- Context menu is shown with **right-click** (not long press)
- Module drag must be disabled during knob/fader operation

**Cable Rules**:
- Cables are drawn above rack and modules
- Cable colors auto-rotate from a fixed palette
- Cable state belongs to top-level app state
- Cables connected to a module are deleted when the module is removed
- Input-input, output-output connections are invalid

**Audio Rules**:
- Due to browser autoplay policies, audio start requires user trigger (Play button)
- Header transport exposes:
  - `Play` / `Stop` buttons
  - `Master volume` slider
  - `green/yellow/red` output indicator

## Current Test Modules

- **Junction**: 4HP passive multiple, 6 jacks vertically centered at `17.78mm` pitch
- **Sine VCO**: Minimal 4HP oscillator with `Pitch` knob, `cv_in`, `audio_out`
- **Speaker**: Minimal 4HP mono output sink with `audio_in`

Minimal sound output steps:
1. Place `Sine VCO`
2. Place `Speaker`
3. Patch `VCO OUT → Speaker IN`
4. Press header `Play`
5. Adjust `Pitch` and `Master`

## Type System

Main types are defined in `src/lib/types.ts`:
- `ModuleKind` - Union type for module kinds
- `RackModuleInstance` - Module instance on rack
- `CableEndpoint` - Cable endpoint (module ID + jack name + role)
- `PatchCable` - Patch cable
- `WasmodEngine` - Audio engine interface

## Important Implementation Details

### Engine Initialization Order (Important)
In `App.svelte`'s `onMount`:
1. **First** create the engine: `await createWasmodEngine()`
2. **Then** add modules: `addModuleAt()`

Reversing this order will prevent initial parameters from being sent to the engine.

### SVG Event Handling
Controls are bound in `autoBindModule.ts`:
- Events captured in capture phase
- Global flag `activeControlPointerId` tracks active control operation
- `RackCanvas.beginModuleDrag` checks flag to prevent module drag

### WASM Engine Communication
In `public/wasm/wasmod-engine.js`:
- `ensureAudio()` initializes AudioWorklet
- Wait for worklet ready before sending messages
- Forward `setParameter`, `connect`, `disconnect` messages to worklet

In `public/wasm/wasmod-worklet.js`:
- Call C++ engine functions via `ccall`
- Process audio buffers on WASM heap
- Send meter data to main thread

## Known Issues and Constraints

### Current DSP Constraints
- DSP is minimal for verification, only checks connection count to `Speaker` to output sound
- `Junction` is UI/patching test only, no passive multiple signal distribution DSP yet
- Full module submission model not yet implemented

### SVG Event Handling Challenges
- SVG element `stopPropagation()` may not work as expected
- Capture phase event listeners conflict with Svelte events
- Module drag may incorrectly trigger during control operation

### Audio Initialization Synchronization
- Messages may be lost during worklet initialization timing
- Implementation needs to wait for `ensureAudio()` Promise resolution
- Initial parameter sending timing is critical

## Commercial-Grade Improvement Plan (In Progress)

**Goal**: Elevate from prototype to commercial-grade beta-ready quality

**Progress**: Phase 1.1 completed, Phases 1.2-4.2 pending

### Phase 1: Fundamental Architecture Improvements ✅ 1.1 complete, 1.2-1.4 pending

#### ✅ 1.1 Component Decomposition and Reconstruction (Complete)
Split App.svelte (1,203 → 608 lines, 50% reduction) into:
- `src/lib/components/layout/TopBar.svelte` - Transport and meters
- `src/lib/components/layout/RackContainer.svelte` - Rack, canvas, minimap
- `src/lib/components/layout/ModulePalette.svelte` - Module palette
- `src/lib/components/layout/SelectionManager.svelte` - Selection cards and actions

**Result**: Applied single responsibility principle, improved maintainability

#### ⏳ 1.2 Structured State Management (Pending)
**Purpose**: Unify scattered state for predictable data flow

**Implementation**:
- Create Svelte stores:
  - `src/lib/stores/RackStore.ts` - Modules, cables, placement
  - `src/lib/stores/AudioStore.ts` - Engine state, parameters, diagnostics
  - `src/lib/stores/SelectionStore.ts` - Selection, context menu
  - `src/lib/stores/UIStore.ts` - Palette, scroll, minimap

**Files to Change**:
- Create: `src/lib/stores/*.ts`
- Modify: `src/App.svelte` (use stores)
- Modify: `src/lib/components/*.svelte` (subscribe to stores)

**Success Criteria**:
- State is centralized
- Component communication via stores
- Reactive updates work correctly

#### ⏳ 1.3 Event Handling Redesign (Pending)
**Purpose**: Resolve conflicts between SVG controls and module drag

**Implementation**:
- Remove capture phase event listeners
- Use CSS `pointer-events`:
  - Only SVG control elements: `pointer-events: auto`
  - SVG background elements: `pointer-events: none`
  - Module drag in explicit drag areas

**Files to Change**:
- Modify: `src/lib/actions/autoBindModule.ts` (simplify event handling)
- Modify: `src/lib/components/RackCanvas.svelte` (improve drag detection)
- Modify: `src/lib/modules/*.svelte` (add pointer-events CSS)

**Success Criteria**:
- Module doesn't move when operating knobs
- Right-click context menu works properly
- Event handling is concise and understandable

#### ⏳ 1.4 Error Handling Introduction (Pending)
**Purpose**: Comprehensive error management and user feedback

**Implementation**:
- Implement error boundaries and error manager:
  - `src/lib/core/ErrorManager.ts` - Error classification, logging, notification
  - `src/lib/components/ErrorBoundary.svelte` - Error catch and UI display

**Files to Change**:
- Create: `src/lib/core/ErrorManager.ts`
- Create: `src/lib/components/ErrorBoundary.svelte`
- Modify: All major components (add error handling)

**Success Criteria**:
- Errors are caught appropriately
- User-friendly error messages displayed
- Errors logged in detail to console

### Phase 2: Audio Engine Stabilization (Pending)

#### ⏳ 2.1 Audio Initialization Enhancement
**Purpose**: Reliable audio engine initialization and error recovery

**Implementation**:
- Strengthen `src/lib/engine/createEngine.ts`:
  - Detailed error reporting
  - Retry logic
  - Clear fallback strategy
- Improve worklet initialization synchronization
- Fix parameter initialization timing

**Success Criteria**:
- Sound outputs reliably
- Initialization errors reported appropriately
- Fallback to mock engine works

#### ⏳ 2.2 Performance Monitoring Addition
**Purpose**: Real-time performance metrics

**Implementation**:
- Track CPU usage, memory usage, audio latency
- UI display of diagnostic information
- Performance warning system

**Success Criteria**:
- CPU/memory usage displayed
- Performance issues warned
- Metrics viewable in dev tools

### Phase 3: Testing Framework Introduction (Pending)

#### ⏳ 3.1 Test Environment Construction
**Purpose**: Foundation for automated testing and regression testing

**Implementation**:
- Setup Vitest or Jest
- Create test utilities
- Strengthen mock engine
- Setup coverage reports

#### ⏳ 3.2 Core Functionality Testing
**Purpose**: Test coverage for important features

**Implementation**:
- State management tests
- Module placement/move/removal tests
- Cable connect/disconnect tests
- Engine initialization tests

**Success Criteria**:
- Major features tested
- Coverage 60%+
- Regression tests run automatically

### Phase 4: Beta Release Preparation (Pending)

#### ⏳ 4.1 Documentation Organization
**Purpose**: Documentation for users and developers

**Implementation**:
- Create user manual
- Expand developer guide
- Create API documentation
- Document known issues

#### ⏳ 4.2 Release Process Establishment
**Purpose**: Beta distribution and feedback collection

**Implementation**:
- Versioning strategy
- Release notes
- Feedback collection mechanism
- GitHub Issues templates

## Component Structure (Current State After Phase 1.1)

```
src/lib/components/
├── layout/           # NEW: Layout components
│   ├── TopBar.svelte           # Transport and meters
│   ├── RackContainer.svelte   # Canvas, minimap, rack hints
│   ├── ModulePalette.svelte    # Module palette
│   └── SelectionManager.svelte # Selection cards and actions
├── ModuleRenderer.svelte         # Module SVG rendering
├── RackCanvas.svelte             # Rack drawing, module move, patching UI
└── ErrorBoundary.svelte          # TODO: Error boundary
```

## Current State Management Issues (Planned for Phase 1.2)

**Current Approach**: State scattered in App.svelte (608 lines)
- Modules, cables, selection state as local variables
- Engine, audio state mixed in
- UI state (palette, scroll) included

**Problems**:
1. Component communication complex via props/events
2. State update logic scattered and hard to track
3. Testing difficult (mocking required)
4. Multiple components need changes for new features

**Post-Phase 1.2 Goals**:
```typescript
// stores/RackStore.ts - Centralized module and cable management
export const rackStore = createRackStore();
// Usage: rackStore.addModule(), rackStore.connectCables()

// stores/AudioStore.ts - Centralized engine state management
export const audioStore = createAudioStore();
// Usage: audioStore.start(), audioStore.setParameter()

// stores/SelectionStore.ts - Centralized selection state management
export const selectionStore = createSelectionStore();
// Usage: selectionStore.selectModule(), selectionStore.clear()
```

## Remaining Work Estimate

- **Phase 1.2 (State Management)**: 1-2 weeks
- **Phase 1.3 (Event Redesign)**: 3-5 days
- **Phase 1.4 (Error Handling)**: 1 week
- **Phase 2 (Audio Stabilization)**: 1-2 weeks
- **Phase 3 (Testing Introduction)**: 1-2 weeks
- **Phase 4 (Beta Preparation)**: 1 week

**Total**: Aim for beta-ready state in about 6-9 weeks

## Priority Order (User Selection)

User chose **fundamental architecture improvements** as top priority:

1. ✅ **Component decomposition** (complete)
2. ⏳ **Structured state management** (next)
3. ⏳ **Event handling redesign**
4. ⏳ **Error handling introduction**

Then: Audio stabilization → Testing introduction → Beta preparation

## Reference Materials

For detailed plans and implementation procedures:
- Plan file: `~/.claude/plans/wild-floating-bunny.md`
- Backup: `src/App.svelte.backup` (pre-refactoring state)

## Future Module Submission Structure

```
modules/
  <maker>/
    <module>/
      module.yml  # Metadata
      ui.svg      # SVG UI
      dsp.cpp     # DSP implementation
      dsp.h       # DSP header
```

Minimum metadata items:
- `maker`, `author`, `name`, `version`, `type`, `description`, `url`, `hp`
