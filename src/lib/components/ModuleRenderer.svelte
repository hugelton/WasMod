<script lang="ts">
  import BlankPanel from '../modules/BlankPanel.svelte';
  import JunctionModule from '../modules/JunctionModule.svelte';
  import SineVcoModule from '../modules/SineVcoModule.svelte';
  import SpeakerModule from '../modules/SpeakerModule.svelte';
  import type { ModuleKind } from '../types';

  export let kind: ModuleKind;
  export let hp: number;
  export let interactive = true;
  export let onParameterChange: (paramName: string, value: number) => void = () => {};
</script>

{#if kind === 'vco4'}
  <SineVcoModule {interactive} {onParameterChange} />
{:else if kind === 'junction4'}
  <JunctionModule />
{:else if kind === 'speaker4'}
  <SpeakerModule />
{:else}
  <BlankPanel {hp} />
{/if}

{#if kind === 'vco4'}
  <SineVcoModule {interactive} {onParameterChange} />
{:else if kind === 'junction4'}
  <JunctionModule />
{:else if kind === 'speaker4'}
  <SpeakerModule />
{:else}
  <BlankPanel {hp} />
{/if}
