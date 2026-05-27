<script lang="ts">
  import { onMount, tick } from 'svelte';
  import RackCanvas from './lib/components/RackCanvas.svelte';
  import ModuleRenderer from './lib/components/ModuleRenderer.svelte';
  import { createWasmodEngine } from './lib/engine/createEngine';
  import { moduleCatalog, moduleOrder, RACK_TOTAL_HP } from './lib/moduleCatalog';
  import type { ModuleKind, PatchCable, PendingCableConnection, RackModuleInstance, WasmodEngine } from './lib/types';

  type PaletteGhost = {
    kind: ModuleKind;
    x: number;
    y: number;
    active: boolean;
    pointerId: number;
  } | null;

  let modules: RackModuleInstance[] = [];
  let cables: PatchCable[] = [];
  let selectedId: string | null = null;
  let actionMenuId: string | null = null;
  let instanceCounter = 1;
  let paletteGhost: PaletteGhost = null;
  let paletteFilter = '';
  let paletteType = 'all';
  let paletteOpen = true;
  let canvasScrollEl: HTMLDivElement;
  let rackUnitPx = 20;
  let menuPosition: { x: number; y: number; side: 'left' | 'right' } | null = null;
  let engine: WasmodEngine | null = null;
  let engineBackend = 'mock';
  let isPlaying = false;
  let masterVolume = 0.72;
  let meterValue = 0;
  let minimap = {
    contentWidth: 0,
    contentHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    scrollLeft: 0,
    scrollTop: 0,
    scale: 1,
    frameWidth: 0,
    frameHeight: 0
  };
  const CABLE_COLORS = ['#f4f4f5', '#ff7a59', '#5ac8fa', '#30d158', '#ffd60a', '#bf5af2'];

  onMount(() => {
    modules = [];
    cables = [];
    addModuleAt('vco4', 0, 0);
    addModuleAt('speaker4', 0, 6);
    addModuleAt('junction4', 0, 12);
    addModuleAt('junction4', 1, 0);
    tick().then(updateMinimap);

    let unsubscribeMeter: (() => void) | null = null;

    createWasmodEngine().then((created) => {
      engine = created;
      engineBackend = created.backend;
      engine.setMasterVolume(masterVolume);
      unsubscribeMeter = created.subscribeMeter((value) => {
        meterValue = value;
      });
    });

    return () => {
      unsubscribeMeter?.();
      engine?.destroy();
    };
  });

  function updateMinimap() {
    if (!canvasScrollEl) {
      return;
    }

    updateRackUnit();

    const contentWidth = canvasScrollEl.scrollWidth;
    const contentHeight = canvasScrollEl.scrollHeight;
    const viewportWidth = canvasScrollEl.clientWidth;
    const viewportHeight = canvasScrollEl.clientHeight;

    const maxWidth = 164;
    const maxHeight = 132;
    const scale = Math.min(maxWidth / contentWidth, maxHeight / contentHeight);

    minimap = {
      contentWidth,
      contentHeight,
      viewportWidth,
      viewportHeight,
      scrollLeft: canvasScrollEl.scrollLeft,
      scrollTop: canvasScrollEl.scrollTop,
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      frameWidth: contentWidth * (Number.isFinite(scale) && scale > 0 ? scale : 1),
      frameHeight: contentHeight * (Number.isFinite(scale) && scale > 0 ? scale : 1)
    };
  }

  function updateRackUnit() {
    if (!canvasScrollEl) {
      return;
    }

    const horizontalPadding = 48;
    const availableWidth = Math.max(320, canvasScrollEl.clientWidth - horizontalPadding);
    rackUnitPx = Math.min(20, availableWidth / RACK_TOTAL_HP);
  }

  function revealSelectedModule() {
    if (!canvasScrollEl || !selectedId) {
      return;
    }

    const selectedModule = canvasScrollEl.querySelector<HTMLElement>(`[data-module-id="${selectedId}"]`);
    selectedModule?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    });
  }

  function updateMenuPosition() {
    if (!actionMenuId) {
      menuPosition = null;
      return;
    }

    const selectedModule = document.querySelector<HTMLElement>(`[data-module-id="${actionMenuId}"]`);
    if (!selectedModule) {
      menuPosition = null;
      return;
    }

    const rect = selectedModule.getBoundingClientRect();
    const menuWidth = 124;
    const menuHeight = 78;
    const gutter = 10;
    const side: 'left' | 'right' =
      rect.right + gutter + menuWidth < window.innerWidth ? 'right' : 'left';
    const x = side === 'right' ? rect.right + gutter : rect.left - gutter - menuWidth;
    const y = Math.min(
      Math.max(8, rect.top + rect.height * 0.5 - menuHeight * 0.5),
      window.innerHeight - menuHeight - 8
    );

    menuPosition = {
      x,
      y,
      side
    };
  }

  function firstAvailableHp(hp: number, rackIndex: number, ignoreId?: string) {
    for (let start = 0; start <= RACK_TOTAL_HP - hp; start += 1) {
      const isBlocked = modules.some((entry) => {
        if (entry.rackIndex !== rackIndex) {
          return false;
        }
        if (ignoreId && entry.id === ignoreId) {
          return false;
        }
        return start < entry.xHp + entry.hp && start + hp > entry.xHp;
      });
      if (!isBlocked) {
        return start;
      }
    }
    return null;
  }

  function canPlaceSpan(rackIndex: number, xHp: number, hp: number, ignoreId?: string) {
    if (xHp < 0 || xHp + hp > RACK_TOTAL_HP) {
      return false;
    }

    return modules.every((entry) => {
      if (entry.rackIndex !== rackIndex) {
        return true;
      }
      if (ignoreId && entry.id === ignoreId) {
        return true;
      }
      return xHp + hp <= entry.xHp || xHp >= entry.xHp + entry.hp;
    });
  }

  function canPlaceModule(moduleId: string, rackIndex: number, nextHp: number) {
    const target = modules.find((entry) => entry.id === moduleId);
    return target ? canPlaceSpan(rackIndex, nextHp, target.hp, moduleId) : false;
  }

  function canPlaceNewModule(kind: ModuleKind, rackIndex: number, nextHp: number) {
    return canPlaceSpan(rackIndex, nextHp, moduleCatalog[kind].hp);
  }

  function addModuleAt(kind: ModuleKind, rackIndex: number, xHp?: number) {
    const hp = moduleCatalog[kind].hp;
    const slot = xHp ?? firstAvailableHp(hp, rackIndex);
    if (slot === null || !canPlaceSpan(rackIndex, slot, hp)) {
      return;
    }

    const instance: RackModuleInstance = {
      id: `${kind}-${instanceCounter++}`,
      kind,
      hp,
      xHp: slot,
      rackIndex
    };

    modules = [...modules, instance];
    selectedId = instance.id;
    actionMenuId = null;
    tick().then(() => {
      updateMinimap();
      revealSelectedModule();
    });
  }

  function beginPaletteDrag(kind: ModuleKind, event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    paletteGhost = {
      kind,
      x: event.clientX,
      y: event.clientY,
      active: true,
      pointerId: event.pointerId
    };
  }

  function dropPaletteModule(clientX: number, clientY: number) {
    if (!paletteGhost?.active) {
      return;
    }

    const rackFrames = Array.from(document.querySelectorAll<HTMLElement>('.rack-frame'));
    const targetRackIndex = rackFrames.findIndex((frame) => {
      const rect = frame.getBoundingClientRect();
      return clientY >= rect.top - 5 && clientY <= rect.bottom + 5;
    });

    if (targetRackIndex === -1) {
      return;
    }

    const container = rackFrames[targetRackIndex]?.querySelector<HTMLElement>('.modules-container');
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const hpPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hp = moduleCatalog[paletteGhost.kind].hp;
    const rawHp = Math.round((clientX - rect.left - (hp * hpPx) / 2) / hpPx);
    const nextHp = Math.max(0, Math.min(RACK_TOTAL_HP - hp, rawHp));

    if (canPlaceNewModule(paletteGhost.kind, targetRackIndex, nextHp)) {
      addModuleAt(paletteGhost.kind, targetRackIndex, nextHp);
    }
  }

  function handleModuleTap(id: string) {
    if (selectedId === id) {
      actionMenuId = actionMenuId === id ? null : id;
      tick().then(updateMenuPosition);
      return;
    }
    selectedId = id;
    actionMenuId = null;
  }

  function clearSelection() {
    selectedId = null;
    actionMenuId = null;
    menuPosition = null;
  }

  function nextCableColor() {
    return CABLE_COLORS[cables.length % CABLE_COLORS.length];
  }

  function sameEndpoint(a: PatchCable['from'], b: PatchCable['from']) {
    return a.moduleId === b.moduleId && a.jackName === b.jackName && a.role === b.role;
  }

  function cablesForModule(moduleId: string) {
    return cables.filter((cable) => cable.from.moduleId === moduleId || cable.to.moduleId === moduleId);
  }

  function removeCables(targetCables: PatchCable[]) {
    if (targetCables.length === 0) {
      return;
    }

    const cableIds = new Set(targetCables.map((cable) => cable.id));
    cables = cables.filter((cable) => !cableIds.has(cable.id));
    targetCables.forEach((cable) => {
      engine?.disconnect(cable.id);
    });
  }

  function duplicateSelected() {
    if (!selectedId) {
      return;
    }

    const selected = modules.find((entry) => entry.id === selectedId);
    if (!selected) {
      return;
    }

    const immediateSlot = selected.xHp + selected.hp;
    const slot = canPlaceSpan(selected.rackIndex, immediateSlot, selected.hp)
      ? immediateSlot
      : firstAvailableHp(selected.hp, selected.rackIndex);

    if (slot !== null) {
      addModuleAt(selected.kind, selected.rackIndex, slot);
    }
  }

  function removeSelected() {
    if (!selectedId) {
      return;
    }

    removeCables(cablesForModule(selectedId));
    modules = modules.filter((entry) => entry.id !== selectedId);
    selectedId = null;
    actionMenuId = null;
    menuPosition = null;
  }

  function togglePalette() {
    paletteOpen = !paletteOpen;
  }

  async function startAudio() {
    if (!engine) {
      return;
    }
    await engine.start();
    isPlaying = true;
  }

  async function stopAudio() {
    if (!engine) {
      return;
    }
    await engine.stop();
    isPlaying = false;
    meterValue = 0;
  }

  function handleMasterVolumeInput(value: number) {
    masterVolume = value;
    engine?.setMasterVolume(value);
  }

  function handleParameterChange(moduleId: string, paramName: string, value: number) {
    engine?.setParameter(moduleId, paramName, value);
  }

  function handleCableConnect(connection: PendingCableConnection) {
    const duplicate = cables.some(
      (cable) =>
        (sameEndpoint(cable.from, connection.from) && sameEndpoint(cable.to, connection.to)) ||
        (sameEndpoint(cable.from, connection.to) && sameEndpoint(cable.to, connection.from))
    );

    if (duplicate) {
      return;
    }

    const cable: PatchCable = {
      id: `cable-${connection.from.moduleId}-${connection.from.jackName}-${connection.to.moduleId}-${connection.to.jackName}-${Date.now()}`,
      color: nextCableColor(),
      from: connection.from,
      to: connection.to
    };

    cables = [...cables, cable];
    engine?.connect(cable.from, cable.to);
  }

  $: filteredModuleOrder = moduleOrder.filter((kind) => {
    const entry = moduleCatalog[kind];
    const query = paletteFilter.trim().toLowerCase();
    const typeMatch = paletteType === 'all' || entry.moduleType === paletteType;
    if (!typeMatch) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      entry.name.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query) ||
      `${entry.hp}hp`.includes(query)
    );
  });

  $: if (canvasScrollEl) {
    modules;
    tick().then(updateMinimap);
  }

  $: if (actionMenuId) {
    modules;
    tick().then(updateMenuPosition);
  }
</script>

<svelte:window
  on:resize={updateMinimap}
  on:scroll={updateMenuPosition}
  on:pointermove={(event) => {
    if (paletteGhost?.active && event.pointerId === paletteGhost.pointerId) {
      paletteGhost = { ...paletteGhost, x: event.clientX, y: event.clientY };
    }
  }}
  on:pointerup={(event) => {
    if (paletteGhost?.active && event.pointerId === paletteGhost.pointerId) {
      dropPaletteModule(event.clientX, event.clientY);
      paletteGhost = null;
    }
  }}
/>

<svelte:head>
  <title>WasMod</title>
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <h1>WasMod</h1>
    <div class="transport">
      <button type="button" class="transport-button" on:click={isPlaying ? stopAudio : startAudio}>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <label class="master-control">
        <span>Master</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          on:input={(event) => handleMasterVolumeInput(Number((event.currentTarget as HTMLInputElement).value))}
        />
      </label>
      <div class="vu-cluster" aria-label={`Output meter ${meterValue.toFixed(2)}`}>
        <span class:active={meterValue > 0.08} class="vu-light green"></span>
        <span class:active={meterValue > 0.52} class="vu-light yellow"></span>
        <span class:active={meterValue > 0.9} class="vu-light red"></span>
      </div>
      <span class="backend-chip">{engineBackend}</span>
    </div>
  </header>

  <main class="workspace">
    <section class="canvas-wrap">
      <div bind:this={canvasScrollEl} class="canvas-scroll" on:scroll={updateMinimap}>
        <RackCanvas
          {modules}
          {cables}
          rackCount={8}
          totalHp={RACK_TOTAL_HP}
          hpUnitPx={rackUnitPx}
          {selectedId}
          {paletteGhost}
          nextCableColor={nextCableColor()}
          {canPlaceModule}
          {canPlaceNewModule}
          on:canvasTap={clearSelection}
          on:moduleTap={(event) => handleModuleTap(event.detail.id)}
          on:parameterChange={(event) =>
            handleParameterChange(event.detail.moduleId, event.detail.paramName, event.detail.value)}
          on:cableConnect={(event) => handleCableConnect(event.detail)}
          on:moveModule={(event) => {
            modules = modules.map((entry) =>
              entry.id === event.detail.id
                ? { ...entry, rackIndex: event.detail.rackIndex, xHp: event.detail.xHp }
                : entry
            );
            selectedId = event.detail.id;
            tick().then(() => {
              updateMinimap();
              revealSelectedModule();
            });
          }}
        />
      </div>

      <div class="minimap">
        <div
          class="minimap-frame"
          style={`width:${minimap.frameWidth}px; height:${minimap.frameHeight}px;`}
        >
          {#if minimap.contentWidth > 0}
            {#each modules as module (module.id)}
              <div
                class="minimap-module"
                style={`left:${module.xHp * rackUnitPx * minimap.scale}px; top:${module.rackIndex * (minimap.contentHeight / 8) * minimap.scale}px; width:${module.hp * rackUnitPx * minimap.scale}px; height:${(minimap.contentHeight / 8) * minimap.scale}px;`}
              ></div>
            {/each}

            <div
              class="minimap-viewport"
              style={`left:${minimap.scrollLeft * minimap.scale}px; top:${minimap.scrollTop * minimap.scale}px; width:${minimap.viewportWidth * minimap.scale}px; height:${minimap.viewportHeight * minimap.scale}px;`}
            ></div>
          {/if}
        </div>
      </div>
    </section>
  </main>

  <section class:open={paletteOpen} class="bottom-palette">
    <div class="bottom-palette-body">
      <div class="palette-header">
        <div class="palette-header-title">Modules</div>
        <label class="palette-filter-select">
          <select bind:value={paletteType}>
            <option value="all">All Types</option>
            <option value="blank">Blank</option>
            <option value="oscillator">Oscillator</option>
            <option value="output">Output</option>
            <option value="utility">Utility</option>
          </select>
        </label>
        <label class="palette-search">
          <input
            type="text"
            bind:value={paletteFilter}
            placeholder="Keyword"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <button type="button" class="palette-close" aria-label="Close module palette" on:click={togglePalette}>
          Close
        </button>
      </div>

      <div class="palette-list">
        {#each filteredModuleOrder as kind}
          {@const module = moduleCatalog[kind]}
          <button
            type="button"
            class="palette-item"
            on:pointerdown={(event) => beginPaletteDrag(kind, event)}
          >
            <div class="palette-preview">
              <ModuleRenderer kind={kind} hp={module.hp} interactive={false} />
            </div>
            <div class="palette-meta">
              <span class="palette-name">{module.name}</span>
              <span class="palette-submeta">{module.moduleType} · {module.hp}HP</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </section>

  {#if !paletteOpen}
    <button type="button" class="palette-fab" aria-label="Open module palette" on:click={togglePalette}>
      <span class="palette-fab-icon">⌕</span>
    </button>
  {/if}

  {#if paletteGhost?.active}
    <div
      class="palette-drag-ghost"
      style={`left:${paletteGhost.x}px; top:${paletteGhost.y}px; width: calc(${moduleCatalog[paletteGhost.kind].hp} * var(--hp)); height: var(--panel-height);`}
    >
      <ModuleRenderer
        kind={paletteGhost.kind}
        hp={moduleCatalog[paletteGhost.kind].hp}
        interactive={false}
      />
    </div>
  {/if}

  {#if actionMenuId && menuPosition}
    <div class="context-menu-layer">
      <div
        class={`module-menu-panel floating ${menuPosition.side === 'left' ? 'point-right' : 'point-left'}`}
        style={`left:${menuPosition.x}px; top:${menuPosition.y}px;`}
      >
        <button type="button" on:click|stopPropagation={duplicateSelected}>Duplicate</button>
        <button type="button" on:click|stopPropagation={removeSelected}>Delete</button>
      </div>
    </div>
  {/if}
</div>
