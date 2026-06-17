<script lang="ts">
  export let isPlaying = false;
  export let masterVolume = 0.72;
  export let meterValue = 0;
  export let engineBackend = 'mock';

  export let onStartAudio: () => void;
  export let onStopAudio: () => void;
  export let onMasterVolumeChange: (value: number) => void;
</script>

<header class="topbar">
  <h1>WasMod</h1>
  <div class="transport">
    <button type="button" class="transport-button" on:click={isPlaying ? onStopAudio : onStartAudio}>
      {isPlaying ? 'Stop' : 'Play'}
    </button>
    <label class="master-control">
      <span>Master</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        {value}
        on:input={(event) => onMasterVolumeChange(Number((event.currentTarget as HTMLInputElement).value))}
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
