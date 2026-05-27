<script lang="ts">
  const PANEL_WIDTH_MM = 20.32;
  const PANEL_HEIGHT_MM = 128.5;
  const CENTER_X_MM = PANEL_WIDTH_MM / 2;
  const CENTER_Y_MM = PANEL_HEIGHT_MM / 2;
  const JACK_PITCH_MM = 17.78;
  const jackYs = Array.from({ length: 6 }, (_, index) => CENTER_Y_MM + (index - 2.5) * JACK_PITCH_MM);
</script>

<svg
  class="module-svg"
  viewBox={`0 0 ${PANEL_WIDTH_MM} ${PANEL_HEIGHT_MM}`}
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Junction 4HP"
  preserveAspectRatio="none"
>
  <defs>
    <g id="junction-jack-face">
      <circle cx="0" cy="0" r="4.8" fill="#0b0c0e" stroke="#2d3138" stroke-width="0.7" />
      <circle cx="0" cy="0" r="2.35" fill="#000000" stroke="#181a1f" stroke-width="0.4" />
    </g>
  </defs>

  <rect x="0" y="0" width={PANEL_WIDTH_MM} height={PANEL_HEIGHT_MM} fill="#ffffff" />
  <rect x="0" y="0" width={PANEL_WIDTH_MM} height={PANEL_HEIGHT_MM} fill="none" stroke="#000000" stroke-width="0.5" />
  <line x1={PANEL_WIDTH_MM} y1="0" x2={PANEL_WIDTH_MM} y2={PANEL_HEIGHT_MM} stroke="#8c8c8c" stroke-width="0.8" />
  <line x1="0" y1={PANEL_HEIGHT_MM} x2={PANEL_WIDTH_MM} y2={PANEL_HEIGHT_MM} stroke="#8c8c8c" stroke-width="0.8" />

  <circle cx="7.5" cy="3.5" r="1.7" fill="#111111" />
  <circle cx="7.5" cy="3.5" r="1.4" fill="#5c5c5c" />
  <circle cx="7.5" cy={PANEL_HEIGHT_MM - 3.5} r="1.7" fill="#111111" />
  <circle cx="7.5" cy={PANEL_HEIGHT_MM - 3.5} r="1.4" fill="#5c5c5c" />

  <text
    x={CENTER_X_MM}
    y="12"
    fill="#101113"
    font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif"
    font-size="2.1"
    font-weight="700"
    text-anchor="middle"
    letter-spacing="0.45"
  >
    JUNCTION
  </text>

  {#each jackYs as y}
    <g transform={`translate(${CENTER_X_MM}, ${y})`} class="jack-face" data-role="both">
      <use href="#junction-jack-face" />
    </g>
  {/each}
</svg>
