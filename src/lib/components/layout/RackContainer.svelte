<script lang="ts">
  import RackCanvas from '../RackCanvas.svelte';
  import type { PatchCable, RackModuleInstance, ModuleKind, PaletteGhost, CableEndpoint, PendingCableConnection } from '../../types';

  export let modules: RackModuleInstance[] = [];
  export let cables: PatchCable[] = [];
  export let selectedId: string | null = null;
  export let selectedModuleIds: string[] = [];
  export let selectedCableId: string | null = null;
  export let paletteGhost: PaletteGhost | null = null;
  export let rackUnitPx = 20;
  export let rackCount = 8;
  export let totalHp = 84;
  export let minimap = {
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

  // Event handlers
  export let onCanvasTap: () => void;
  export let onModuleTap: (id: string) => void;
  export let onAreaSelect: (ids: string[]) => void;
  export let onCableTap: (id: string) => void;
  export let onModuleContextMenu: (id: string, clientX: number, clientY: number) => void;
  export let onCableContextMenu: (id: string, clientX: number, clientY: number) => void;
  export let onCableDisconnect: (id: string) => void;
  export let onParameterChange: (moduleId: string, paramName: string, value: number) => void;
  export let onCableConnect: (connection: PendingCableConnection) => void;
  export let onMoveModule: (details: { id: string; rackIndex: number; xHp: number }) => void;
  export let onMoveModules: (details: { moves: Array<{ id: string; rackIndex: number; xHp: number }> }) => void;

  // Helper functions
  export let canPlaceModule: (moduleId: string, rackIndex: number, nextHp: number) => boolean;
  export let canPlaceNewModule: (kind: ModuleKind, rackIndex: number, nextHp: number) => boolean;
  export let nextCableColor: () => string;
  export let updateMinimap: () => void;
  export let canvasScrollEl: HTMLDivElement;

  function nextCableColorDefault() {
    const colors = ['#f4f4f5', '#ff7a59', '#5ac8fa', '#30d158', '#ffd60a', '#bf5af2'];
    return cables.length % colors.length;
  }
</script>

<section class="canvas-wrap">
  <div bind:this={canvasScrollEl} class="canvas-scroll" on:scroll={updateMinimap}>
    <RackCanvas
      {modules}
      {cables}
      {rackCount}
      {totalHp}
      {hpUnitPx}
      {selectedId}
      {selectedModuleIds}
      {selectedCableId}
      {paletteGhost}
      nextCableColor={nextCableColor ? nextCableColor() : nextCableColorDefault()}
      {canPlaceModule}
      {canPlaceNewModule}
      on:canvasTap={onCanvasTap}
      on:moduleTap={(event) => onModuleTap(event.detail.id)}
      on:areaSelectModules={(event) => onAreaSelect(event.detail.ids)}
      on:cableTap={(event) => {
        onCableTap(event.detail.id);
      }}
      on:moduleContextMenu={(event) =>
        onModuleContextMenu(event.detail.id, event.detail.clientX, event.detail.clientY)}
      on:cableContextMenu={(event) =>
        onCableContextMenu(event.detail.id, event.detail.clientX, event.detail.clientY)}
      on:cableDisconnect={(event) => {
        onCableDisconnect(event.detail.id);
      }}
      on:parameterChange={(event) =>
        onParameterChange(event.detail.moduleId, event.detail.paramName, event.detail.value)}
      on:cableConnect={(event) => onCableConnect(event.detail)}
      on:moveModule={(event) => {
        onMoveModule({
          id: event.detail.id,
          rackIndex: event.detail.rackIndex,
          xHp: event.detail.xHp
        });
      }}
      on:moveModules={(event) => onMoveModules(event.detail)}
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

  {#if modules.length === 0}
    <div class="rack-hint-card prominent">
      <p>The rack is empty. You can add modules from the module palette.</p>
    </div>
  {/if}
</section>
