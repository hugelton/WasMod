<script lang="ts">
  import { moduleCatalog } from '../../moduleCatalog';
  import type { RackModuleInstance, PatchCable } from '../../types';

  export let selectedId: string | null = null;
  export let selectedModuleIds: string[] = [];
  export let selectedCableId: string | null = null;
  export let selectedModule: RackModuleInstance | null = null;
  export let selectedCable: PatchCable | null = null;
  export let selectedModuleCableCount = 0;

  export let onDuplicate: () => void;
  export let onDisconnect: () => void;
  export let onCycleCableColor: () => void;
  export let onRemoveCable: () => void;
  export let onOpenContextMenu: (type: 'module' | 'cable') => void;

  function endpointLabel(endpoint: { moduleId: string; jackName: string }): string {
    return `${endpoint.moduleId}.${endpoint.jackName}`;
  }
</script>

<section class="selection-bar">
  {#if selectedModule}
    <aside class="selection-card" aria-live="polite">
      <span class="selection-kicker">Selected Module</span>
      <strong>{moduleCatalog[selectedModule.kind].name}</strong>
      <span>{selectedModule.hp}HP · Row {selectedModule.rackIndex + 1} · Position {selectedModule.xHp}HP</span>
      <span>{selectedModuleCableCount} cable{selectedModuleCableCount === 1 ? '' : 's'} attached</span>
      <div class="selection-actions">
        <button type="button" on:click={onDuplicate}>Duplicate</button>
        <button type="button" disabled={selectedModuleCableCount === 0} on:click={onDisconnect}>
          Disconnect
        </button>
        <button type="button" on:click={() => onOpenContextMenu('module')}>More</button>
      </div>
    </aside>
  {:else if selectedCable}
    <aside class="selection-card" aria-live="polite">
      <span class="selection-kicker">Selected Cable</span>
      <strong>{endpointLabel(selectedCable.from)} → {endpointLabel(selectedCable.to)}</strong>
      <span>Drag an endpoint handle to reroute it, or use the context menu for cable actions.</span>
      <div class="selection-actions">
        <button type="button" on:click={onCycleCableColor}>Color</button>
        <button type="button" class="danger" on:click={onRemoveCable}>Delete</button>
        <button type="button" on:click={() => onOpenContextMenu('cable')}>More</button>
      </div>
    </aside>
  {/if}
</section>
