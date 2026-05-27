<script lang="ts">
  import { autoBindModule } from '../actions/autoBindModule';

  export let onParameterChange: (paramName: string, value: number) => void;
</script>

<svg
  use:autoBindModule={{ onParameterChange }}
  class="module-svg"
  viewBox="0 0 30.48 128.5"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Simple VCA module"
>
  <defs>
    <g id="vca_standard_knob">
      <circle cx="0" cy="0.9" r="6.6" fill="rgba(0,0,0,0.22)" />
      <circle cx="0" cy="0" r="6.6" fill="#29384a" stroke="#14202c" stroke-width="0.8" />
      <line x1="0" y1="0" x2="0" y2="-4.8" stroke="#eef2f7" stroke-width="1.2" stroke-linecap="round" />
    </g>
    <g id="vca_standard_jack">
      <circle cx="0" cy="0.7" r="4.6" fill="rgba(0,0,0,0.28)" />
      <circle class="jack-ring" cx="0" cy="0" r="4.6" fill="#7f8c8d" stroke="#d8dde2" stroke-width="0.8" />
      <circle cx="0" cy="0" r="2.2" fill="#111" />
    </g>
  </defs>

  <rect width="30.48" height="128.5" rx="2.5" fill="#d5d8dc" stroke="#9aa4b0" stroke-width="0.6" />
  <rect width="30.48" height="8.2" rx="2.5" fill="#2d7fb8" />
  <rect y="5.8" width="30.48" height="2.4" fill="#2d7fb8" />
  <text x="15.24" y="5.6" fill="#fff" font-family="Arial, sans-serif" font-weight="900" font-size="4.2" text-anchor="middle" letter-spacing="0.4">VCA</text>

  <circle cx="7.5" cy="3.5" r="1.7" fill="#bdc3c7" />
  <circle cx="7.5" cy="125" r="1.7" fill="#bdc3c7" />

  <text x="15.24" y="23" fill="#333" font-family="Arial" font-weight="bold" font-size="3.2" text-anchor="middle">LEVEL</text>
  <g class="wm__knob" transform="translate(15.24, 34.5)" data-name="Level" data-min="0" data-max="1" data-value="0.8">
    <use href="#vca_standard_knob" class="knob-graphic" />
  </g>
  <rect x="7.2" y="43.8" width="16.1" height="5" fill="#1a1d20" rx="1.1" />
  <text class="param-display" data-target="Level" x="15.24" y="47.5" fill="#f8b04c" font-family="monospace" font-size="3" text-anchor="middle">0.80</text>

  <line x1="5.4" y1="80" x2="25.08" y2="80" stroke="#b7c0c7" stroke-width="0.5" />

  <text x="15.24" y="88" fill="#333" font-family="Arial" font-weight="bold" font-size="3" text-anchor="middle">CV</text>
  <g class="wm__input jack-node" transform="translate(15.24, 99)" data-name="cv_in" data-bias="0">
    <use href="#vca_standard_jack" />
  </g>

  <rect x="5.8" y="107" width="18.88" height="15.2" fill="#324455" rx="1.6" />
  <text x="15.24" y="111.9" fill="#ecf0f1" font-family="Arial" font-weight="bold" font-size="3.3" text-anchor="middle">OUT</text>
  <g class="wm__output jack-node" transform="translate(15.24, 116.4)" data-name="audio_out" data-min="-5" data-max="5">
    <use href="#vca_standard_jack" />
  </g>
</svg>
