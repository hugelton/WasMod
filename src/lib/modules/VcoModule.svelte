<script lang="ts">
  import { autoBindModule } from '../actions/autoBindModule';

  export let onParameterChange: (paramName: string, value: number) => void;
</script>

<svg
  use:autoBindModule={{ onParameterChange }}
  class="module-svg"
  viewBox="0 0 50.8 128.5"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Simple VCO module"
>
  <defs>
    <g id="vco_standard_knob">
      <circle cx="0" cy="0.9" r="7" fill="rgba(0,0,0,0.22)" />
      <circle cx="0" cy="0" r="7" fill="#29384a" stroke="#14202c" stroke-width="0.8" />
      <line x1="0" y1="0" x2="0" y2="-5.1" stroke="#eef2f7" stroke-width="1.2" stroke-linecap="round" />
    </g>
    <g id="vco_standard_jack">
      <circle cx="0" cy="0.7" r="4.6" fill="rgba(0,0,0,0.28)" />
      <circle class="jack-ring" cx="0" cy="0" r="4.6" fill="#7f8c8d" stroke="#d8dde2" stroke-width="0.8" />
      <circle cx="0" cy="0" r="2.2" fill="#111" />
    </g>
  </defs>

  <rect width="50.8" height="128.5" rx="2.5" fill="#d5d8dc" stroke="#9aa4b0" stroke-width="0.6" />
  <rect width="50.8" height="8.2" rx="2.5" fill="#e4573d" />
  <rect y="5.8" width="50.8" height="2.4" fill="#e4573d" />
  <text x="25.4" y="5.6" fill="#fff" font-family="Arial, sans-serif" font-weight="900" font-size="4.4" text-anchor="middle" letter-spacing="0.5">VCO</text>

  <circle cx="7.5" cy="3.5" r="1.7" fill="#bdc3c7" />
  <circle cx="48.14" cy="3.5" r="1.7" fill="#bdc3c7" />
  <circle cx="7.5" cy="125" r="1.7" fill="#bdc3c7" />
  <circle cx="48.14" cy="125" r="1.7" fill="#bdc3c7" />

  <text x="25.4" y="18.8" fill="#333" font-family="Arial" font-weight="bold" font-size="3.5" text-anchor="middle">FREQ</text>
  <g class="wm__knob" transform="translate(25.4, 28.5)" data-name="Frequency" data-min="20" data-max="20000" data-value="440">
    <use href="#vco_standard_knob" class="knob-graphic" />
  </g>
  <rect x="16.8" y="36.8" width="17.2" height="5" fill="#1a1d20" rx="1.1" />
  <text class="param-display" data-target="Frequency" x="25.4" y="40.5" fill="#f8b04c" font-family="monospace" font-size="3.1" text-anchor="middle">440</text>

  <text x="25.4" y="50.5" fill="#333" font-family="Arial" font-weight="bold" font-size="3.5" text-anchor="middle">FINE</text>
  <g class="wm__knob" transform="translate(25.4, 60.2)" data-name="FineTune" data-min="-1" data-max="1" data-value="0">
    <use href="#vco_standard_knob" class="knob-graphic" transform="scale(0.86)" />
  </g>
  <rect x="16.8" y="68.6" width="17.2" height="5" fill="#1a1d20" rx="1.1" />
  <text class="param-display" data-target="FineTune" x="25.4" y="72.3" fill="#f8b04c" font-family="monospace" font-size="3.1" text-anchor="middle">0.00</text>

  <line x1="8" y1="82" x2="42.8" y2="82" stroke="#b7c0c7" stroke-width="0.5" />

  <text x="14.2" y="89.2" fill="#333" font-family="Arial" font-weight="bold" font-size="2.9" text-anchor="middle">V/OCT</text>
  <g class="wm__input jack-node" transform="translate(14.2, 98.5)" data-name="v_oct_in" data-bias="0">
    <use href="#vco_standard_jack" />
  </g>

  <text x="36.6" y="89.2" fill="#333" font-family="Arial" font-weight="bold" font-size="2.9" text-anchor="middle">FM</text>
  <g class="wm__input jack-node" transform="translate(36.6, 98.5)" data-name="fm_in" data-bias="0">
    <use href="#vco_standard_jack" />
  </g>

  <rect x="15.2" y="106.2" width="20.4" height="16.4" fill="#324455" rx="1.6" />
  <text x="25.4" y="111.2" fill="#ecf0f1" font-family="Arial" font-weight="bold" font-size="3.5" text-anchor="middle">OUT</text>
  <g class="wm__output jack-node" transform="translate(25.4, 116.5)" data-name="audio_out" data-min="-5" data-max="5">
    <use href="#vco_standard_jack" />
  </g>
</svg>
