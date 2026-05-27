<script lang="ts">
  export let hp = 4;

  const MM_PER_HP = 5.08;
  const PANEL_HEIGHT_MM = 128.5;
  const SCREW_OUTER_R = 1.7;
  const SCREW_INNER_R = 1.4;
  const SCREW_OFFSET_X = 7.5;
  const SCREW_OFFSET_Y = 3.5;

  $: widthMm = hp * MM_PER_HP;
  $: rightScrewX = widthMm - SCREW_OFFSET_X;
  $: usesCenterScrews = hp <= 3;
  $: centerScrewX = widthMm / 2;
</script>

<svg
  class="module-svg"
  viewBox={`0 0 ${widthMm} ${PANEL_HEIGHT_MM}`}
  xmlns="http://www.w3.org/2000/svg"
  aria-label={`${hp}HP blank panel`}
  preserveAspectRatio="none"
>
  <rect x="0" y="0" width={widthMm} height={PANEL_HEIGHT_MM} fill="#ffffff" />
  <rect x="0" y="0" width={widthMm} height={PANEL_HEIGHT_MM} fill="none" stroke="#000000" stroke-width="0.5" />
  <line x1={widthMm} y1="0" x2={widthMm} y2={PANEL_HEIGHT_MM} stroke="#8c8c8c" stroke-width="0.8" />
  <line x1="0" y1={PANEL_HEIGHT_MM} x2={widthMm} y2={PANEL_HEIGHT_MM} stroke="#8c8c8c" stroke-width="0.8" />

  {#if usesCenterScrews}
    <circle cx={centerScrewX} cy={SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
    <circle cx={centerScrewX} cy={SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />
    <circle cx={centerScrewX} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
    <circle cx={centerScrewX} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />
  {:else}
    <circle cx={SCREW_OFFSET_X} cy={SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
    <circle cx={SCREW_OFFSET_X} cy={SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />
    <circle cx={SCREW_OFFSET_X} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
    <circle cx={SCREW_OFFSET_X} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />

    {#if hp >= 8}
      <circle cx={rightScrewX} cy={SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
      <circle cx={rightScrewX} cy={SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />
      <circle cx={rightScrewX} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_OUTER_R} fill="#111111" />
      <circle cx={rightScrewX} cy={PANEL_HEIGHT_MM - SCREW_OFFSET_Y} r={SCREW_INNER_R} fill="#5c5c5c" />
    {/if}
  {/if}

  <text
    x={widthMm / 2}
    y={PANEL_HEIGHT_MM / 2}
    fill="#1a1a1a"
    font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif"
    font-size="3"
    font-weight="600"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="0.5"
  >
    {hp}HP
  </text>
</svg>
