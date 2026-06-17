<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createWasmodEngine } from './lib/engine/createEngine';
  import { moduleCatalog, moduleOrder, RACK_TOTAL_HP, RACK_COUNT } from './lib/moduleCatalog';
  import TopBar from './lib/components/layout/TopBar.svelte';
  import RackContainer from './lib/components/layout/RackContainer.svelte';
  import ModulePalette from './lib/components/layout/ModulePalette.svelte';
  import SelectionManager from './lib/components/layout/SelectionManager.svelte';
  import type { ModuleKind, RackModuleInstance, PatchCable, PaletteGhost, WasmodEngine } from './lib/types';

  // Constants
  const PATCH_STORAGE_KEY = 'wasmod.patch.v1';

  // State
  let modules: RackModuleInstance[] = [];
  let cables: PatchCable[] = [];
  let selectedId: string | null = null;
  let selectedModuleIds: string[] = [];
  let selectedCableId: string | null = null;
  let actionMenuId: string | null = null;
  let actionMenuKind: 'module' | 'cable' | null = null;
  let instanceCounter = 1;
  let paletteGhost: PaletteGhost | null = null;
  let paletteFilter = '';
  let paletteType = 'all';
  let paletteOpen = true;
  let canvasScrollEl: HTMLDivElement;
  let rackUnitPx = 20;
  let menuPosition: { x: number; y: number; side: 'left' | 'right' } | null = null;
  let engine: WasmodEngine | null = null;
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

  // Computed properties
  $: selectedModule = modules.find((m) => m.id === selectedId) ?? null;
  $: selectedCable = cables.find((c) => c.id === selectedCableId) ?? null;
  $: selectedModuleCableCount = cables.filter(
    (c) => c.from.moduleId === selectedId || c.to.moduleId === selectedId
  ).length;

  $: filteredModuleOrder = moduleOrder.filter((kind) => {
    const entry = moduleCatalog[kind];
    const query = paletteFilter.trim().toLowerCase();
    const typeMatch = paletteType === 'all' || entry.moduleType === paletteType;
    if (!typeMatch) return false;
    if (!query) return true;
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

  // Lifecycle
  onMount(async () => {
    // Create engine first
    const created = await createWasmodEngine();
    engine = created;
    engine.setMasterVolume(masterVolume);

    const unsubscribeMeter = created.subscribeMeter((value) => {
      meterValue = value;
    });

    // Add starter modules
    modules = [];
    cables = [];
    addModuleAt('vco4', 0, 0);
    addModuleAt('speaker4', 0, 6);
    tick().then(updateMinimap);

    return () => {
      unsubscribeMeter?.();
      engine?.destroy();
    };
  });

  // Helper functions
  function firstAvailableHp(hp: number, rackIndex: number, ignoreId?: string) {
    for (let start = 0; start <= RACK_TOTAL_HP - hp; start += 1) {
      const isBlocked = modules.some((entry) => {
        if (entry.rackIndex !== rackIndex) return false;
        if (ignoreId && entry.id === ignoreId) return false;
        return start < entry.xHp + entry.hp && start + hp > entry.xHp;
      });
      if (!isBlocked) return start;
    }
    return null;
  }

  function canPlaceSpan(rackIndex: number, xHp: number, hp: number, ignoreId?: string) {
    if (xHp < 0 || xHp + hp > RACK_TOTAL_HP) return false;
    return modules.every((entry) => {
      if (entry.rackIndex !== rackIndex) return true;
      if (ignoreId && entry.id === ignoreId) return true;
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
    if (slot === null || !canPlaceSpan(rackIndex, slot, hp)) return;

    const instance: RackModuleInstance = {
      id: `${kind}-${instanceCounter++}`,
      kind,
      hp,
      xHp: slot,
      rackIndex
    };

    modules = [...modules, instance];
    selectedId = instance.id;
    selectedModuleIds = [instance.id];
    selectedCableId = null;
    actionMenuId = null;
    tick().then(() => {
      updateMinimap();
      revealSelectedModule();
    });
  }

  function updateMinimap() {
    if (!canvasScrollEl) return;

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
    if (!canvasScrollEl) return;

    const horizontalPadding = 48;
    const availableWidth = Math.max(320, canvasScrollEl.clientWidth - horizontalPadding);
    rackUnitPx = Math.min(20, availableWidth / RACK_TOTAL_HP);
  }

  function revealSelectedModule() {
    if (!canvasScrollEl || !selectedId) return;

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
    const side: 'left' | 'right' = rect.right + gutter + menuWidth < window.innerWidth ? 'right' : 'left';
    const x = side === 'right' ? rect.right + gutter : rect.left - gutter - menuWidth;
    const y = Math.min(
      Math.max(8, rect.top + rect.height * 0.5 - menuHeight * 0.5),
      window.innerHeight - menuHeight - 8
    );

    menuPosition = { x, y, side };
  }

  // Audio functions
  async function startAudio() {
    if (!engine) return;
    await engine.start();
    isPlaying = true;
  }

  async function stopAudio() {
    if (!engine) return;
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

  // Module functions
  function handleModuleTap(id: string) {
    selectedId = id;
    selectedModuleIds = [id];
    selectedCableId = null;
    actionMenuId = null;
    actionMenuKind = null;
  }

  function handleModuleContextMenu(id: string, clientX: number, clientY: number) {
    selectedId = id;
    selectedModuleIds = [id];
    selectedCableId = null;
    actionMenuId = id;
    actionMenuKind = 'module';
    tick().then(() => {
      updateMenuPosition();
    });
  }

  function handleAreaSelect(ids: string[]) {
    selectedModuleIds = ids;
    selectedId = ids[0] ?? null;
    selectedCableId = null;
    actionMenuId = null;
    actionMenuKind = null;
  }

  function handleCableContextMenu(id: string, clientX: number, clientY: number) {
    selectedCableId = id;
    selectedId = null;
    selectedModuleIds = [];
    actionMenuId = id;
    actionMenuKind = 'cable';
    tick().then(() => {
      updateMenuPosition();
    });
  }

  function clearSelection() {
    selectedId = null;
    selectedModuleIds = [];
    selectedCableId = null;
    actionMenuId = null;
    actionMenuKind = null;
    menuPosition = null;
  }

  function nextCableColor() {
    const colors = ['#f4f4f5', '#ff7a59', '#5ac8fa', '#30d158', '#ffd60a', '#bf5af2'];
    return colors[cables.length % colors.length];
  }

  function sameEndpoint(a: PatchCable['from'], b: PatchCable['from']) {
    return a.moduleId === b.moduleId && a.jackName === b.jackName && a.role === b.role;
  }

  function cablesForModule(moduleId: string) {
    return cables.filter((cable) => cable.from.moduleId === moduleId || cable.to.moduleId === moduleId);
  }

  function removeCables(targetCables: PatchCable[]) {
    if (targetCables.length === 0) return;

    const cableIds = new Set(targetCables.map((cable) => cable.id));
    cables = cables.filter((cable) => !cableIds.has(cable.id));
    targetCables.forEach((cable) => {
      engine?.disconnect(cable.id);
    });
  }

  function removeSelectedCable() {
    if (!selectedCableId) return;
    const target = cables.find((c) => c.id === selectedCableId);
    if (target) {
      removeCables([target]);
    }
    selectedCableId = null;
    selectedId = null;
    selectedModuleIds = [];
  }

  function duplicateSelected() {
    if (!selectedId) return;

    const selected = modules.find((entry) => entry.id === selectedId);
    if (!selected) return;

    const immediateSlot = selected.xHp + selected.hp;
    const slot = canPlaceSpan(selected.rackIndex, immediateSlot, selected.hp)
      ? immediateSlot
      : firstAvailableHp(selected.hp, selected.rackIndex);

    if (slot !== null) {
      addModuleAt(selected.kind, selected.rackIndex, slot);
    }
  }

  function removeSelected() {
    if (!selectedId) return;

    removeCables(cablesForModule(selectedId));
    modules = modules.filter((entry) => entry.id !== selectedId);
    selectedId = null;
    selectedModuleIds = [];
    actionMenuId = null;
    actionMenuKind = null;
    menuPosition = null;
  }

  function disconnectSelectedModule() {
    if (!selectedId) return;
    const moduleCables = cablesForModule(selectedId);
    removeCables(moduleCables);
  }

  function cycleSelectedCableColor() {
    if (!selectedCableId) return;

    const colors = ['#f4f4f5', '#ff7a59', '#5ac8fa', '#30d158', '#ffd60a', '#bf5af2'];
    const currentColorIndex = colors.indexOf(cables.find((c) => c.id === selectedCableId)?.color ?? '');
    const nextColorIndex = (currentColorIndex + 1) % colors.length;

    cables = cables.map((cable) =>
      cable.id === selectedCableId ? { ...cable, color: colors[nextColorIndex] } : cable
    );
  }

  function openSelectedContextMenu(kind: 'module' | 'cable') {
    // Context menu logic would go here
    console.log('Open context menu for', kind);
  }

  // Cable functions
  function handleCableConnect(connection: { from: any; to: any }) {
    const duplicate = cables.some(
      (cable) =>
        (sameEndpoint(cable.from, connection.from) && sameEndpoint(cable.to, connection.to)) ||
        (sameEndpoint(cable.from, connection.to) && sameEndpoint(cable.to, connection.from))
    );

    if (duplicate) return;

    const cable: PatchCable = {
      id: `cable-${connection.from.moduleId}-${connection.from.jackName}-${connection.to.moduleId}-${connection.to.jackName}-${Date.now()}`,
      color: nextCableColor(),
      from: connection.from,
      to: connection.to
    };

    cables = [...cables, cable];
    engine?.connect(cable.from, cable.to);
  }

  // Palette functions
  function beginPaletteDrag(kind: ModuleKind, event: PointerEvent) {
    if (event.button !== 0) return;

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
    if (!paletteGhost?.active) return;

    const rackFrames = Array.from(document.querySelectorAll<HTMLElement>('.rack-frame'));
    const targetRackIndex = rackFrames.findIndex((frame) => {
      const rect = frame.getBoundingClientRect();
      return clientY >= rect.top - 5 && clientY <= rect.bottom + 5;
    });

    if (targetRackIndex === -1) return;

    const container = rackFrames[targetRackIndex]?.querySelector<HTMLElement>('.modules-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const hpPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hp = moduleCatalog[paletteGhost.kind].hp;
    const rawHp = Math.round((clientX - rect.left - (hp * hpPx) / 2) / hpPx);
    const nextHp = Math.max(0, Math.min(RACK_TOTAL_HP - hp, rawHp));

    if (canPlaceNewModule(paletteGhost.kind, targetRackIndex, nextHp)) {
      addModuleAt(paletteGhost.kind, targetRackIndex, nextHp);
    }

    paletteGhost = null;
  }

  function togglePalette() {
    paletteOpen = !paletteOpen;
  }

  // Module move functions
  function handleModuleMove(details: { id: string; rackIndex: number; xHp: number }) {
    modules = modules.map((entry) =>
      entry.id === details.id ? { ...entry, rackIndex: details.rackIndex, xHp: details.xHp } : entry
    );
    selectedId = details.id;
    selectedModuleIds = [details.id];
    tick().then(() => {
      updateMinimap();
      revealSelectedModule();
    });
  }

  function handleModuleMoves(moves: Array<{ id: string; rackIndex: number; xHp: number }>) {
    modules = modules.map((entry) => {
      const move = moves.find((m) => m.id === entry.id);
      return move ? { ...entry, rackIndex: move.rackIndex, xHp: move.xHp } : entry;
    });
  }

  // Event handlers for window
  function handleWindowPointerMove(event: PointerEvent) {
    if (paletteGhost?.active && event.pointerId === paletteGhost.pointerId) {
      paletteGhost = { ...paletteGhost, x: event.clientX, y: event.clientY };
    }
  }

  function handleWindowPointerUp(event: PointerEvent) {
    if (paletteGhost?.active && event.pointerId === paletteGhost.pointerId) {
      dropPaletteModule(event.clientX, event.clientY);
      paletteGhost = null;
    }
  }
</script>

<svelte:head>
  <title>WasMod</title>
</svelte:head>

<div class="app-shell">
  <TopBar
    {isPlaying}
    {masterVolume}
    {meterValue}
    engineBackend={engine?.backend ?? 'mock'}
    onStartAudio={startAudio}
    onStopAudio={stopAudio}
    onMasterVolumeChange={handleMasterVolumeInput}
  />

  <main class="workspace">
    <RackContainer
      {modules}
      {cables}
      {selectedId}
      {selectedModuleIds}
      {selectedCableId}
      {paletteGhost}
      {rackUnitPx}
      rackCount={RACK_COUNT}
      totalHp={RACK_TOTAL_HP}
      {minimap}
      {canPlaceModule}
      {canPlaceNewModule}
      nextCableColor={nextCableColor}
      updateMinimap={updateMinimap}
      canvasScrollEl={canvasScrollEl}
      onCanvasTap={clearSelection}
      onModuleTap={handleModuleTap}
      onAreaSelect={handleAreaSelect}
      onCableTap={(event) => {
        selectedCableId = event.detail.id;
        selectedId = null;
        selectedModuleIds = [];
        actionMenuId = null;
        actionMenuKind = null;
      }}
      onModuleContextMenu={handleModuleContextMenu}
      onCableContextMenu={handleCableContextMenu}
      onCableDisconnect={(event) => {
        const target = cables.find((cable) => cable.id === event.detail.id);
        if (target) {
          removeCables([target]);
        }
      }}
      onParameterChange={handleParameterChange}
      onCableConnect={handleCableConnect}
      onMoveModule={handleModuleMove}
      onMoveModules={handleModuleMoves}
    />

    <SelectionManager
      {selectedId}
      {selectedModuleIds}
      {selectedCableId}
      {selectedModule}
      {selectedCable}
      {selectedModuleCableCount}
      onDuplicate={duplicateSelected}
      onDisconnect={disconnectSelectedModule}
      onCycleCableColor={cycleSelectedCableColor}
      onRemoveCable={removeSelectedCable}
      onOpenContextMenu={openSelectedContextMenu}
    />
  </main>

  <ModulePalette
    {paletteOpen}
    {paletteType}
    {paletteFilter}
    {filteredModuleOrder}
    onToggle={togglePalette}
    onBeginDrag={beginPaletteDrag}
  />

  {#if !paletteOpen}
    <button
      type="button"
      class="palette-fab"
      aria-label="Open module palette"
      on:click={togglePalette}
    >
      <span class="palette-fab-icon">⌕</span>
    </button>
  {/if}

  {#if paletteGhost?.active}
    <div
      class="palette-drag-ghost"
      style={`left:${paletteGhost.x}px; top:${paletteGhost.y}px; width: calc(${moduleCatalog[paletteGhost.kind].hp} * var(--hp)); height: var(--panel-height);`}
    >
      <ModuleRenderer kind={paletteGhost.kind} hp={moduleCatalog[paletteGhost.kind].hp} interactive={false} />
    </div>
  {/if}

  {#if actionMenuId && menuPosition}
    <div class="context-menu-layer">
      <div
        class={`module-menu-panel floating ${menuPosition.side === 'left' ? 'point-right' : 'point-left'}`}
        style={`left:${menuPosition.x}px; top:${menuPosition.y}px;`}
      >
        {#if actionMenuKind === 'module'}
          <button type="button" on:click={duplicateSelected}>Duplicate</button>
          <button type="button" on:click={removeSelected}>Delete</button>
        {:else if actionMenuKind === 'cable'}
          <button type="button" on:click={cycleSelectedCableColor}>Color</button>
          <button type="button" class="danger" on:click={removeSelectedCable}>Delete</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<svelte:window
  on:resize={updateMinimap}
  on:scroll={updateMenuPosition}
  on:pointermove={handleWindowPointerMove}
  on:pointerup={handleWindowPointerUp}
/>
