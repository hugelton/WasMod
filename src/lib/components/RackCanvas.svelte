<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { moduleCatalog } from '../moduleCatalog';
  import { moduleJacks } from '../moduleSpecs';
  import ModuleRenderer from './ModuleRenderer.svelte';
  import { isActiveControl } from '../actions/autoBindModule';
  import type { CableEndpoint, ModuleKind, PatchCable, PendingCableConnection, RackModuleInstance } from '../types';

  type PaletteGhost = {
    kind: ModuleKind;
    x: number;
    y: number;
    active: boolean;
  } | null;

  type DragState = {
    id: string;
    pointerId: number;
    targetRackIndex: number;
    previewHp: number;
    offsetHp: number;
  } | null;

  type WiringState = {
    pointerId: number;
    from: CableEndpoint;
    x: number;
    y: number;
    startClientX: number;
    startClientY: number;
    replaceCableId?: string;
    replaceEndpoint?: 'from' | 'to';
  } | null;

  type ClickGuard = {
    pointerId: number;
    moduleId: string;
    moved: boolean;
    startClientX: number;
    startClientY: number;
  } | null;

  const dispatch = createEventDispatcher<{
    canvasTap: void;
    moduleTap: { id: string };
    cableTap: { id: string };
    moduleContextMenu: { id: string; clientX: number; clientY: number };
    moveModule: { id: string; rackIndex: number; xHp: number };
    addModuleDrop: { kind: ModuleKind; rackIndex: number; xHp: number };
    parameterChange: { moduleId: string; paramName: string; value: number };
    cableConnect: PendingCableConnection;
  }>();

  export let modules: RackModuleInstance[] = [];
  export let totalHp = 84;
  export let rackCount = 8;
  export let hpUnitPx = 20;
  export let selectedId: string | null = null;
  export let selectedCableId: string | null = null;
  export let paletteGhost: PaletteGhost = null;
  export let cables: PatchCable[] = [];
  export let nextCableColor = '#f4f4f5';
  export let canPlaceModule: (moduleId: string, rackIndex: number, nextHp: number) => boolean;
  export let canPlaceNewModule: (kind: ModuleKind, rackIndex: number, nextHp: number) => boolean;

  let rackRoot: HTMLDivElement;
  let dragState: DragState = null;
  let modulesByRack: RackModuleInstance[][] = [];
  let wiringState: WiringState = null;
  let clickGuard: ClickGuard = null;
  let pendingJack: CableEndpoint | null = null;
  let hoveredCableId: string | null = null;

  function sameEndpoint(a: CableEndpoint, b: CableEndpoint) {
    return a.moduleId === b.moduleId && a.jackName === b.jackName && a.role === b.role;
  }

  function canConnectEndpoints(from: CableEndpoint, to: CableEndpoint) {
    if (sameEndpoint(from, to)) {
      return false;
    }

    const pair = [from.role, to.role];
    if (pair.includes('both')) {
      return true;
    }

    return pair.includes('input') && pair.includes('output');
  }

  function cableExists(from: CableEndpoint, to: CableEndpoint) {
    return cables.some(
      (cable) =>
        (sameEndpoint(cable.from, from) && sameEndpoint(cable.to, to)) ||
        (sameEndpoint(cable.from, to) && sameEndpoint(cable.to, from))
    );
  }

  function hpInPixels() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function cableStrokeWidth() {
    return hpInPixels() * (3.5 / 5.08);
  }

  function getRackFrame(index: number) {
    return rackRoot?.querySelector<HTMLElement>(`.rack-frame[data-rack-index="${index}"]`) ?? null;
  }

  function rackIndexFromPoint(clientY: number) {
    for (let index = 0; index < rackCount; index += 1) {
      const frame = getRackFrame(index);
      if (!frame) {
        continue;
      }
      const rect = frame.getBoundingClientRect();
      if (clientY >= rect.top - 5 && clientY <= rect.bottom + 5) {
        return index;
      }
    }
    return null;
  }

  function previewHpForRack(rackIndex: number, clientX: number, offsetHp: number, hp: number) {
    const frame = getRackFrame(rackIndex);
    const container = frame?.querySelector<HTMLElement>('.modules-container');
    if (!container) {
      return 0;
    }
    const rect = container.getBoundingClientRect();
    const mouseXInContainer = clientX - rect.left;
    const rawHp = mouseXInContainer / hpInPixels() - offsetHp;
    const maxHp = totalHp - hp;
    return Math.max(0, Math.min(maxHp, Math.round(rawHp)));
  }

  function beginModuleDrag(module: RackModuleInstance, event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    if (isActiveControl(event.pointerId)) {
      return;
    }

    const target = event.target as Element | null;
    if (target?.closest('.wm__knob, .wm__fader, .wm__button, .wm__led_button, .wm__input, .wm__output, .jack-hit, .knob-graphic, .fader-cap, .btn-graphic, .btn-led')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const frame = getRackFrame(module.rackIndex);
    const container = frame?.querySelector<HTMLElement>('.modules-container');
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const mouseXInContainer = event.clientX - rect.left;

    dragState = {
      id: module.id,
      pointerId: event.pointerId,
      targetRackIndex: module.rackIndex,
      previewHp: module.xHp,
      offsetHp: mouseXInContainer / hpInPixels() - module.xHp
    };
    clickGuard = {
      pointerId: event.pointerId,
      moduleId: module.id,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
  }

  function getDraggedModule() {
    return dragState ? modules.find((entry) => entry.id === dragState?.id) ?? null : null;
  }

  function getPalettePreview() {
    if (!paletteGhost?.active) {
      return null;
    }

    const rackIndex = rackIndexFromPoint(paletteGhost.y);
    if (rackIndex === null) {
      return null;
    }

    const hp = moduleCatalog[paletteGhost.kind].hp;
    const previewHp = previewHpForRack(rackIndex, paletteGhost.x, hp / 2, hp);
    return {
      rackIndex,
      hp,
      xHp: previewHp,
      valid: canPlaceNewModule(paletteGhost.kind, rackIndex, previewHp)
    };
  }

  function onCanvasPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const moduleElement = target?.closest<HTMLElement>('[data-module-id]');
    const cableElement = target?.closest<HTMLElement>('[data-cable-id]');
    if (!moduleElement && !cableElement) {
      dispatch('canvasTap');
    }
  }

  function onModuleClick(id: string) {
    if (clickGuard?.moduleId === id && clickGuard.moved) {
      return;
    }
    dispatch('moduleTap', { id });
  }

  function onModuleContextMenu(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    dispatch('moduleContextMenu', { id, clientX: event.clientX, clientY: event.clientY });
  }

  function mmToEm(mm: number) {
    return mm / 5.08;
  }

  function getJackCenter(endpoint: CableEndpoint) {
    const module = modules.find((entry) => entry.id === endpoint.moduleId);
    if (!module || !rackRoot) {
      return null;
    }

    const jackSpec = moduleJacks[module.kind]?.find((jack) => jack.name === endpoint.jackName);
    if (jackSpec) {
      const hpPx = hpInPixels();
      const mmPx = hpPx / 5.08;
      const panelHeightPx = 128.5 * mmPx;
      const moduleXHp = dragState?.id === module.id ? dragState.previewHp : module.xHp;
      const moduleRackIndex = dragState?.id === module.id ? dragState.targetRackIndex : module.rackIndex;

      return {
        x: moduleXHp * hpPx + jackSpec.xMm * mmPx,
        y: moduleRackIndex * panelHeightPx + jackSpec.yMm * mmPx
      };
    }

    const jackElement = rackRoot.querySelector<HTMLElement>(
      `[data-jack-module-id="${endpoint.moduleId}"][data-jack-name="${endpoint.jackName}"]`
    );
    if (!jackElement) {
      return null;
    }

    const jackRect = jackElement.getBoundingClientRect();
    const rackRect = rackRoot.getBoundingClientRect();

    return {
      x: jackRect.left - rackRect.left + jackRect.width / 2,
      y: jackRect.top - rackRect.top + jackRect.height / 2
    };
  }

  function buildCablePath(from: { x: number; y: number }, to: { x: number; y: number }) {
    const tension = Math.max(32, Math.abs(to.x - from.x) * 0.45);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + tension} ${to.x} ${to.y + tension} ${to.x} ${to.y}`;
  }

  function beginWiring(event: PointerEvent, endpoint: CableEndpoint) {
    beginCableDrag(event, endpoint);
  }

  function beginCableDrag(
    event: PointerEvent,
    endpoint: CableEndpoint,
    replaceCableId?: string,
    replaceEndpoint?: 'from' | 'to'
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const center = getJackCenter(endpoint);
    if (!center) {
      return;
    }

    wiringState = {
      pointerId: event.pointerId,
      from: endpoint,
      x: center.x,
      y: center.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      replaceCableId,
      replaceEndpoint
    };
  }

  function applyPendingJack(endpoint: CableEndpoint) {
    if (!pendingJack) {
      pendingJack = endpoint;
      return;
    }

    if (sameEndpoint(pendingJack, endpoint)) {
      pendingJack = null;
      return;
    }

    if (canConnectEndpoints(pendingJack, endpoint) && !cableExists(pendingJack, endpoint)) {
      dispatch('cableConnect', {
        from: pendingJack,
        to: endpoint
      });
    }

    pendingJack = null;
  }

  function handleJackPointerUp(event: PointerEvent, endpoint: CableEndpoint) {
    if (!wiringState || event.pointerId !== wiringState.pointerId) {
      return;
    }

    const moved =
      Math.abs(event.clientX - wiringState.startClientX) > 4 || Math.abs(event.clientY - wiringState.startClientY) > 4;

    if (moved) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    applyPendingJack(endpoint);
  }

  function beginCableEndpointMove(event: PointerEvent, cable: PatchCable, endpoint: 'from' | 'to') {
    const anchor = endpoint === 'from' ? cable.to : cable.from;
    beginCableDrag(event, anchor, cable.id, endpoint);
    pendingJack = null;
    dispatch('cableTap', { id: cable.id });
  }

  function handleCableClick(event: MouseEvent, cableId: string) {
    event.preventDefault();
    event.stopPropagation();
    pendingJack = null;
    dispatch('cableTap', { id: cableId });
  }

  function finishWiring(clientX: number, clientY: number) {
    if (!wiringState) {
      return;
    }

    const targetElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-jack-module-id][data-jack-name]');

    if (!targetElement) {
      wiringState = null;
      return;
    }

    const endpoint: CableEndpoint = {
      moduleId: targetElement.dataset.jackModuleId ?? '',
      jackName: targetElement.dataset.jackName ?? '',
      role: (targetElement.dataset.jackRole as CableEndpoint['role']) ?? 'both'
    };

    if (
      endpoint.moduleId &&
      endpoint.jackName &&
      canConnectEndpoints(wiringState.from, endpoint) &&
      (!cableExists(wiringState.from, endpoint) || wiringState.replaceCableId)
    ) {
      const nextConnection =
        wiringState.replaceEndpoint === 'from'
          ? {
              from: endpoint,
              to: wiringState.from
            }
          : wiringState.replaceEndpoint === 'to'
            ? {
                from: wiringState.from,
                to: endpoint
              }
            : {
                from: wiringState.from,
                to: endpoint
              };
      dispatch('cableConnect', {
        ...nextConnection,
        replaceCableId: wiringState.replaceCableId,
        replaceEndpoint: wiringState.replaceEndpoint
      });
    }

    wiringState = null;
  }

  $: modulesByRack = modules.reduce<RackModuleInstance[][]>((racks, module) => {
    racks[module.rackIndex]?.push(module);
    return racks;
  }, Array.from({ length: rackCount }, () => []));

  $: palettePreview = getPalettePreview();
</script>

<svelte:window
  on:pointermove={(event) => {
    if (clickGuard && event.pointerId === clickGuard.pointerId) {
      const moved =
        Math.abs(event.clientX - clickGuard.startClientX) > 4 || Math.abs(event.clientY - clickGuard.startClientY) > 4;
      if (moved && !clickGuard.moved) {
        clickGuard = { ...clickGuard, moved: true };
      }
    }

    if (wiringState && event.pointerId === wiringState.pointerId) {
      const moved =
        Math.abs(event.clientX - wiringState.startClientX) > 4 ||
        Math.abs(event.clientY - wiringState.startClientY) > 4;
      const rackRect = rackRoot?.getBoundingClientRect();
      if (rackRect) {
        wiringState = {
          ...wiringState,
          x: event.clientX - rackRect.left,
          y: event.clientY - rackRect.top
        };
        if (moved && clickGuard?.pointerId === event.pointerId) {
          clickGuard = { ...clickGuard, moved: true };
        }
      }
    }

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const dragged = getDraggedModule();
    if (!dragged) {
      return;
    }

    const rackIndex = rackIndexFromPoint(event.clientY);
    if (rackIndex === null) {
      return;
    }

    dragState = {
      ...dragState,
      targetRackIndex: rackIndex,
      previewHp: previewHpForRack(rackIndex, event.clientX, dragState.offsetHp, dragged.hp)
    };
  }}
  on:pointerup={(event) => {
    if (wiringState && event.pointerId === wiringState.pointerId) {
      finishWiring(event.clientX, event.clientY);
    }

    if (dragState && event.pointerId === dragState.pointerId) {
      const dragged = getDraggedModule();
      if (dragged && canPlaceModule(dragged.id, dragState.targetRackIndex, dragState.previewHp)) {
        dispatch('moveModule', {
          id: dragged.id,
          rackIndex: dragState.targetRackIndex,
          xHp: dragState.previewHp
        });
      }
      dragState = null;
    }

    if (clickGuard && event.pointerId === clickGuard.pointerId) {
      queueMicrotask(() => {
        if (clickGuard?.pointerId === event.pointerId) {
          clickGuard = null;
        }
      });
    }
  }}
  on:pointercancel={(event) => {
    if (dragState && event.pointerId === dragState.pointerId) {
      dragState = null;
    }
    if (wiringState && event.pointerId === wiringState.pointerId) {
      wiringState = null;
    }
    if (clickGuard && event.pointerId === clickGuard.pointerId) {
      clickGuard = null;
    }
  }}
/>

<div
  bind:this={rackRoot}
  class="rack-root"
  role="presentation"
  style={`font-size:${hpUnitPx}px; width: calc(${totalHp} * var(--hp)); min-width: calc(${totalHp} * var(--hp));`}
  on:pointerdown={onCanvasPointerDown}
>
  <svg class="cable-layer" aria-hidden="true">
    {#each cables as cable (cable.id)}
      {@const fromCenter = getJackCenter(cable.from)}
      {@const toCenter = getJackCenter(cable.to)}
      {@const cablePath = fromCenter && toCenter ? buildCablePath(fromCenter, toCenter) : null}
      {@const cableIsFocused = selectedCableId === cable.id || hoveredCableId === cable.id}
      {#if fromCenter && toCenter}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <path
          d={cablePath}
          stroke="transparent"
          stroke-width={Math.max(14, cableStrokeWidth() + 10)}
          fill="none"
          stroke-linecap="round"
          class="cable-hit"
          data-cable-id={cable.id}
          on:pointerenter={() => {
            hoveredCableId = cable.id;
          }}
          on:pointerleave={() => {
            if (hoveredCableId === cable.id) {
              hoveredCableId = null;
            }
          }}
          on:click={(event) => handleCableClick(event, cable.id)}
        />
        <path
          d={cablePath}
          stroke="#050607"
          stroke-width={cableStrokeWidth() + 2.2}
          fill="none"
          stroke-linecap="round"
          class:cable-focused={cableIsFocused}
          class="cable-path cable-shadow"
        />
        <path
          d={cablePath}
          stroke={cable.color}
          stroke-width={cableStrokeWidth()}
          fill="none"
          stroke-linecap="round"
          class:cable-focused={cableIsFocused}
          class="cable-path cable-main"
        />
        <path
          d={cablePath}
          stroke="rgba(255,255,255,0.38)"
          stroke-width={Math.max(1.2, cableStrokeWidth() * 0.34)}
          fill="none"
          stroke-linecap="round"
          class:cable-focused={cableIsFocused}
          class="cable-path cable-highlight"
        />
        {#if selectedCableId === cable.id}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle
            class="cable-endpoint-handle"
            cx={fromCenter.x}
            cy={fromCenter.y}
            r={8}
            on:pointerdown={(event) => beginCableEndpointMove(event, cable, 'from')}
          />
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle
            class="cable-endpoint-handle"
            cx={toCenter.x}
            cy={toCenter.y}
            r={8}
            on:pointerdown={(event) => beginCableEndpointMove(event, cable, 'to')}
          />
        {/if}
      {/if}
    {/each}

    {#if wiringState}
      {@const fromCenter = getJackCenter(wiringState.from)}
      {@const activePath = fromCenter ? buildCablePath(fromCenter, { x: wiringState.x, y: wiringState.y }) : null}
      {#if fromCenter}
        <path
          d={activePath}
          stroke="#050607"
          stroke-width={cableStrokeWidth() + 2.2}
          fill="none"
          stroke-linecap="round"
          class="cable-path cable-shadow"
        />
        <path
          d={activePath}
          stroke={nextCableColor}
          stroke-width={cableStrokeWidth()}
          fill="none"
          stroke-linecap="round"
          class="cable-path cable-main"
        />
        <path
          d={activePath}
          stroke="rgba(255,255,255,0.38)"
          stroke-width={Math.max(1.2, cableStrokeWidth() * 0.34)}
          fill="none"
          stroke-linecap="round"
          class="cable-path cable-highlight"
        />
      {/if}
    {/if}
  </svg>

  {#each Array.from({ length: rackCount }, (_, index) => index) as rackIndex}
    <div class="rack-frame" data-rack-index={rackIndex}>
      <div class="rail top"><div class="rail-holes"></div></div>
      <div class="rail bottom"><div class="rail-holes"></div></div>

      <div class="modules-container">
        {#each modulesByRack[rackIndex] ?? [] as module (module.id)}
          {@const isDraggingSource = dragState?.id === module.id}
          <div
            class="module"
            class:selected={selectedId === module.id}
            class:drag-source={isDraggingSource}
            data-module-id={module.id}
            role="button"
            tabindex="0"
            style={`width: calc(${module.hp} * var(--hp)); left: ${module.xHp}em;`}
            on:pointerdown={(event) => beginModuleDrag(module, event)}
            on:click={() => onModuleClick(module.id)}
            on:contextmenu={(event) => onModuleContextMenu(module.id, event)}
            on:keydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onModuleClick(module.id);
              }
            }}
          >
            <ModuleRenderer
              kind={module.kind}
              hp={module.hp}
              onParameterChange={(paramName, value) =>
                dispatch('parameterChange', { moduleId: module.id, paramName, value })}
            />

            {#if moduleJacks[module.kind]}
              {#each moduleJacks[module.kind] as jack}
                <button
                  type="button"
                  class="jack-hit"
                  class:selected={pendingJack && sameEndpoint(pendingJack, {
                    moduleId: module.id,
                    jackName: jack.name,
                    role: jack.role
                  })}
                  data-jack-module-id={module.id}
                  data-jack-name={jack.name}
                  data-jack-role={jack.role}
                  aria-label={`${module.id} ${jack.name}`}
                  tabindex="-1"
                  style={`left: calc(${mmToEm(jack.xMm)}em - 7px); top: calc(${mmToEm(jack.yMm)}em - 7px);`}
                  on:pointerdown={(event) =>
                    beginWiring(event, {
                      moduleId: module.id,
                      jackName: jack.name,
                      role: jack.role
                    })}
                  on:pointerup={(event) =>
                    handleJackPointerUp(event, {
                      moduleId: module.id,
                      jackName: jack.name,
                      role: jack.role
                    })}
                ></button>
              {/each}
            {/if}
          </div>
        {/each}

        {#if dragState?.targetRackIndex === rackIndex}
          {@const dragged = getDraggedModule()}
          {#if dragged}
            <div
              class="module ghost-module {canPlaceModule(dragged.id, rackIndex, dragState.previewHp) ? '' : 'invalid'}"
              style={`width: calc(${dragged.hp} * var(--hp)); left: ${dragState.previewHp}em;`}
            >
              <ModuleRenderer kind={dragged.kind} hp={dragged.hp} interactive={false} />
            </div>
          {/if}
        {/if}

        {#if palettePreview?.rackIndex === rackIndex && paletteGhost}
          <div
            class="module ghost-module {palettePreview.valid ? '' : 'invalid'}"
            style={`width: calc(${palettePreview.hp} * var(--hp)); left: ${palettePreview.xHp}em;`}
          >
            <ModuleRenderer kind={paletteGhost.kind} hp={palettePreview.hp} interactive={false} />
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>
