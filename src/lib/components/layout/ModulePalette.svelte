<script lang="ts">
  import { moduleCatalog } from '../../moduleCatalog';
  import ModuleRenderer from '../ModuleRenderer.svelte';
  import type { ModuleKind } from '../../types';

  export let isOpen = false;
  export let paletteType = 'all';
  export let paletteFilter = '';
  export let filteredModuleOrder: ModuleKind[] = [];

  export let onToggle: () => void;
  export let onBeginDrag: (kind: ModuleKind, event: PointerEvent) => void;
</script>

<section class:open={isOpen} class="bottom-palette" aria-hidden={!isOpen} inert={!isOpen}>
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
      <button
        type="button"
        class="palette-close"
        aria-label="Close module palette"
        aria-expanded={isOpen}
        on:click={onToggle}
      >
        Close
      </button>
    </div>

    <div class="palette-list">
      {#each filteredModuleOrder as kind}
        {@const module = moduleCatalog[kind]}
        <button
          type="button"
          class="palette-item"
          on:pointerdown={(event) => onBeginDrag(kind, event)}
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
