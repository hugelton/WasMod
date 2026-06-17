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
  aria-label="Speaker 4HP"
  preserveAspectRatio="none"
>
  <defs>
    <g id="speaker-jack">
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

  <text x="10.16" y="11" fill="#131417" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="3.4" font-weight="700" text-anchor="middle" letter-spacing="0.35">
    OUT
  </text>

  <text x="10.16" y="22.4" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.35" font-weight="600" text-anchor="middle">
    MASTER
  </text>
  <g
    class="wm__fader"
    transform="translate(10.16, 30)"
    data-name="Master"
    data-min="0"
    data-max="1"
    data-value="0.72"
    data-step="0.01"
    data-track-length="46"
  >
    <rect x="-1.35" y="0" width="2.7" height="46" fill="#111318" stroke="#30343a" stroke-width="0.45" rx="1.1" />
    <line x1="0" y1="3.5" x2="0" y2="42.5" stroke="#454b53" stroke-width="0.5" stroke-linecap="round" />
    <g class="fader-cap">
      <rect x="-5.25" y="-2.1" width="10.5" height="4.2" fill="#20242a" stroke="#0e1014" stroke-width="0.5" rx="1.1" />
      <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#f4f5f7" stroke-width="0.55" stroke-linecap="round" />
    </g>
  </g>

  <text x="10.16" y="103.6" fill="#4b4f56" font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="2.5" font-weight="600" text-anchor="middle">
    IN
  </text>
  <g class="wm__input" transform="translate(10.16, 114.5)" data-name="audio_in" data-bias="0">
    <use href="#speaker-jack" />
  </g>
</svg>
