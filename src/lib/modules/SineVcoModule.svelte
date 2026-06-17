<script lang="ts">
  import { autoBindModule } from '../actions/autoBindModule';

  export let onParameterChange: (paramName: string, value: number) => void;
  export let interactive = true;
</script>

<svg
  use:autoBindModule={{ onParameterChange, disabled: !interactive }}
  class="module-svg"
  viewBox="0 0 20.32 128.5"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Sine VCO 4HP"
  preserveAspectRatio="none"
>
  <defs>
    <g id="sine-vco-knob">
      <circle cx="0" cy="0.75" r="5.2" fill="rgba(0,0,0,0.22)" />
      <circle cx="0" cy="0" r="5.2" fill="#20242a" stroke="#0e1014" stroke-width="0.6" />
      <line x1="0" y1="0" x2="0" y2="-3.8" stroke="#f4f5f7" stroke-width="0.9" stroke-linecap="round" />
    </g>
    <g id="sine-vco-jack">
      <circle cx="0" cy="0.55" r="4.3" fill="rgba(0,0,0,0.24)" />
      <circle cx="0" cy="0" r="4.3" fill="#101216" stroke="#2a2e34" stroke-width="0.7" />
      <circle cx="0" cy="0" r="2" fill="#000" />
    </g>
  </defs>

  <rect x="0" y="0" width="20.32" height="128.5" fill="#ffffff" />
  <rect x="0" y="0" width="20.32" height="128.5" fill="none" stroke="#000000" stroke-width="0.5" />
  <line x1="20.32" y1="0" x2="20.32" y2="128.5" stroke="#8c8c8c" stroke-width="0.8" />
  <line x1="0" y1="128.5" x2="20.32" y2="128.5" stroke="#8c8c8c" stroke-width="0.8" />

  <circle cx="7.5" cy="3.5" r="1.7" fill="#111111" />
  <circle cx="7.5" cy="3.5" r="1.4" fill="#5c5c5c" />
  <circle cx="7.5" cy="125" r="1.7" fill="#111111" />
  <circle cx="7.5" cy="125" r="1.4" fill="#5c5c5c" />

  <text x="10.16" y="11" fill="#131417" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="3.8" font-weight="700" text-anchor="middle" letter-spacing="0.35">
    VCO
  </text>
  <text x="10.16" y="21" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.5" font-weight="600" text-anchor="middle">
    PITCH
  </text>

  <g
    class="wm__knob"
    transform="translate(10.16, 32)"
    data-name="Pitch"
    data-min="-3"
    data-max="3"
    data-value="0"
    data-step="0.01"
    data-reset-value="0"
  >
    <use href="#sine-vco-knob" class="knob-graphic" />
    <circle class="knob-hit" cx="0" cy="0" r="7.2" fill="transparent" />
  </g>

  <text x="10.16" y="54.6" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.2" font-weight="600" text-anchor="middle">
    WAVE
  </text>
  <g
    class="wm__switch"
    transform="translate(10.16, 64.2)"
    data-name="Waveform"
    data-min="0"
    data-max="2"
    data-value="2"
    data-step="1"
    data-start="-5.2"
    data-end="5.2"
    data-orientation="vertical"
  >
    <rect x="-1.6" y="-6.6" width="3.2" height="13.2" fill="#101216" stroke="#30343a" stroke-width="0.45" rx="1.3" />
    <line x1="0" y1="-4.8" x2="0" y2="4.8" stroke="#454b53" stroke-width="0.45" stroke-linecap="round" />
    <circle cx="0" cy="-5.2" r="0.45" fill="#7a8088" />
    <circle cx="0" cy="0" r="0.45" fill="#7a8088" />
    <circle cx="0" cy="5.2" r="0.45" fill="#7a8088" />
    <rect class="switch-thumb" x="-3.05" y="-1.65" width="6.1" height="3.3" fill="#f08a45" stroke="#111214" stroke-width="0.45" rx="0.8" />
    <rect x="-5" y="-8" width="10" height="16" fill="transparent" />
  </g>
  <text x="2.7" y="59.55" fill="#131417" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="1.85" font-weight="700">SAW</text>
  <text x="2.7" y="64.75" fill="#131417" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="1.65" font-weight="700">SQUARE</text>
  <text x="2.7" y="69.95" fill="#131417" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="1.85" font-weight="700">SINE</text>

  <text x="10.16" y="81.5" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.5" font-weight="600" text-anchor="middle">
    CV
  </text>
  <g class="wm__input" transform="translate(10.16, 92.5)" data-name="cv_in" data-bias="0">
    <use href="#sine-vco-jack" />
  </g>

  <text x="10.16" y="103.6" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.5" font-weight="600" text-anchor="middle">
    OUT
  </text>
  <g class="wm__output" transform="translate(10.16, 114.5)" data-name="audio_out" data-min="-5" data-max="5">
    <use href="#sine-vco-jack" />
  </g>
</svg>
