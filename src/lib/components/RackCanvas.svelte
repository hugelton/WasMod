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
    groupIds: string[];
    groupOrigins: Record<string, { rackIndex: number; xHp: number }>;
  } | null;

  type AreaSelectionState = {
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    moved: boolean;
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
    cableContextMenu: { id: string; clientX: number; clientY: number };
    moveModule: { id: string; rackIndex: number; xHp: number };
    moveModules: { moves: Array<{ id: string; rackIndex: number; xHp: number }> };
    areaSelectModules: { ids: string[] };
    addModuleDrop: { kind: ModuleKind; rackIndex: number; xHp: number };
    parameterChange: { moduleId: string; paramName: string; value: number };
    cableConnect: PendingCableConnection;
    cableDisconnect: { id: string };
  }>();

  export let modules: RackModuleInstance[] = [];
  export let totalHp = 84;
  export let rackCount = 8;
  export let hpUnitPx = 20;
  export let selectedId: string | null = null;
  export let selectedModuleIds: string[] = [];
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
  let areaSelectionState: AreaSelectionState = null;

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
    return rackRoot ? parseFloat(getComputedStyle(rackRoot).fontSize) : hpUnitPx;
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

  function rootPoint(clientX: number, clientY: number) {
    const rect = rackRoot.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function selectionRect() {
    if (!areaSelectionState) {
      return null;
    }
    const left = Math.min(areaSelectionState.startX, areaSelectionState.currentX);
    const top = Math.min(areaSelectionState.startY, areaSelectionState.currentY);
    const right = Math.max(areaSelectionState.startX, areaSelectionState.currentX);
    const bottom = Math.max(areaSelectionState.startY, areaSelectionState.currentY);
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
      right,
      bottom
    };
  }

  function moduleRect(module: RackModuleInstance) {
    const hpPx = hpInPixels();
    const panelHeightPx = hpPx * (128.5 / 5.08);
    return {
      left: module.xHp * hpPx,
      right: (module.xHp + module.hp) * hpPx,
      top: module.rackIndex * panelHeightPx,
      bottom: (module.rackIndex + 1) * panelHeightPx
    };
  }

  function rectsIntersect(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number }
  ) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function getPreviewModule(module: RackModuleInstance) {
    if (!dragState || !dragState.groupIds.includes(module.id)) {
      return module;
    }

    const origin = dragState.groupOrigins[module.id];
    const activeOrigin = dragState.groupOrigins[dragState.id];
    if (!origin || !activeOrigin) {
      return module;
    }

    return {
      ...module,
      rackIndex: origin.rackIndex + (dragState.targetRackIndex - activeOrigin.rackIndex),
      xHp: origin.xHp + (dragState.previewHp - activeOrigin.xHp)
    };
  }

  function beginModuleDrag(module: RackModuleInstance, event: PointerEvent) {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      dispatch('moduleContextMenu', { id: module.id, clientX: event.clientX, clientY: event.clientY });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (isActiveControl(event.pointerId)) {
      return;
    }

    const target = event.target as Element | null;
    if (target?.closest('.wm__knob, .wm__fader, .wm__switch, .wm__button, .wm__led_button, .wm__input, .wm__output, .jack-hit, .knob-graphic, .fader-cap, .switch-thumb, .btn-graphic, .btn-led')) {
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
    const groupIds =
      selectedModuleIds.length > 1 && selectedModuleIds.includes(module.id) ? selectedModuleIds : [module.id];
    const groupOrigins = Object.fromEntries(
      modules
        .filter((entry) => groupIds.includes(entry.id))
        .map((entry) => [entry.id, { rackIndex: entry.rackIndex, xHp: entry.xHp }])
    );

    dragState = {
      id: module.id,
      pointerId: event.pointerId,
      targetRackIndex: module.rackIndex,
      previewHp: module.xHp,
      offsetHp: mouseXInContainer / hpInPixels() - module.xHp,
      groupIds,
      groupOrigins
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
      const point = rootPoint(event.clientX, event.clientY);
      areaSelectionState = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        moved: false
      };
      rackRoot.setPointerCapture?.(event.pointerId);
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

  function openModuleKeyboardMenu(module: RackModuleInstance, event: KeyboardEvent) {
    const isContextShortcut = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!isContextShortcut) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch('moduleContextMenu', {
      id: module.id,
      clientX: rect.right,
      clientY: rect.top + rect.height * 0.5
    });
  }

  function mmToEm(mm: number) {
    return mm / 5.08;
  }

  function getJackCenter(endpoint: CableEndpoint, sourceModules = modules, currentDragState = dragState) {
    const module = sourceModules.find((entry) => entry.id === endpoint.moduleId);
    if (!module || !rackRoot) {
      return null;
    }

    const jackSpec = moduleJacks[module.kind]?.find((jack) => jack.name === endpoint.jackName);
    if (jackSpec) {
      const hpPx = hpInPixels();
      const mmPx = hpPx / 5.08;
      const panelHeightPx = 128.5 * mmPx;
      const previewModule = currentDragState ? getPreviewModule(module) : module;
      const moduleXHp = previewModule.xHp;
      const moduleRackIndex = previewModule.rackIndex;

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

  function cableHandlePoint(from: { x: number; y: number }, to: { x: number; y: number }) {
    const tension = Math.max(32, Math.abs(to.x - from.x) * 0.45);
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 + tension * 0.75
    };
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

    const center = getJackCenter(endpoint, modules, dragState);
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

  function handleCableContextMenu(event: MouseEvent, cableId: string) {
    event.preventDefault();
    event.stopPropagation();
    pendingJack = null;
    dispatch('cableContextMenu', { id: cableId, clientX: event.clientX, clientY: event.clientY });
  }

  function handleCablePointerDown(event: PointerEvent, cableId: string) {
    if (event.button !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pendingJack = null;
    dispatch('cableContextMenu', { id: cableId, clientX: event.clientX, clientY: event.clientY });
  }

  function finishWiring(clientX: number, clientY: number) {
    if (!wiringState) {
      return;
    }

    const moved =
      Math.abs(clientX - wiringState.startClientX) > 4 || Math.abs(clientY - wiringState.startClientY) > 4;

    const targetElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-jack-module-id][data-jack-name]');

    if (!targetElement) {
      if (wiringState.replaceCableId && moved) {
        dispatch('cableDisconnect', { id: wiringState.replaceCableId });
      }
      wiringState = null;
      return;
    }

    const endpoint: CableEndpoint = {
      moduleId: targetElement.dataset.jackModuleId ?? '',
      jackName: targetElement.dataset.jackName ?? '',
      role: (targetElement.dataset.jackRole as CableEndpoint['role']) ?? 'both'
    };

    let connected = false;
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
      connected = true;
    }

    if (wiringState.replaceCableId && moved && !connected) {
      dispatch('cableDisconnect', { id: wiringState.replaceCableId });
    }

    wiringState = null;
  }

  $: modulesByRack = modules.reduce<RackModuleInstance[][]>((racks, module) => {
    const displayedModule =
      dragState?.groupIds.includes(module.id) ? getPreviewModule(module) : module;
    racks[displayedModule.rackIndex]?.push(displayedModule);
    return racks;
  }, Array.from({ length: rackCount }, () => []));

  $: palettePreview = getPalettePreview();
</script>

<svelte:window
  on:pointermove={(event) => {
    if (areaSelectionState && event.pointerId === areaSelectionState.pointerId) {
      const point = rootPoint(event.clientX, event.clientY);
      const moved =
        Math.abs(point.x - areaSelectionState.startX) > 4 || Math.abs(point.y - areaSelectionState.startY) > 4;
      areaSelectionState = {
        ...areaSelectionState,
        currentX: point.x,
        currentY: point.y,
        moved: areaSelectionState.moved || moved
      };
    }

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
    if (areaSelectionState && event.pointerId === areaSelectionState.pointerId) {
      const rect = selectionRect();
      if (rect && areaSelectionState.moved) {
        const ids = modules.filter((module) => rectsIntersect(rect, moduleRect(module))).map((module) => module.id);
        dispatch('areaSelectModules', { ids });
      } else {
        dispatch('canvasTap');
      }
      areaSelectionState = null;
      rackRoot?.releasePointerCapture?.(event.pointerId);
    }

    if (wiringState && event.pointerId === wiringState.pointerId) {
      finishWiring(event.clientX, event.clientY);
    }

    if (dragState && event.pointerId === dragState.pointerId) {
      const dragged = getDraggedModule();
      if (dragged && dragState.groupIds.length > 1) {
        const moves = dragState.groupIds
          .map((id) => {
            const module = modules.find((entry) => entry.id === id);
            return module ? getPreviewModule(module) : null;
          })
          .filter((module): module is RackModuleInstance => Boolean(module))
          .map((module) => ({ id: module.id, rackIndex: module.rackIndex, xHp: module.xHp }));
        dispatch('moveModules', { moves });
      } else if (dragged && canPlaceModule(dragged.id, dragState.targetRackIndex, dragState.previewHp)) {
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
    if (areaSelectionState && event.pointerId === areaSelectionState.pointerId) {
      areaSelectionState = null;
    }
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
  {#if areaSelectionState && selectionRect()}
    {@const rect = selectionRect()}
    {#if rect}
      <div
        class="area-selection-box"
        style={`left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;`}
      ></div>
    {/if}
  {/if}

  <svg class="cable-layer" aria-hidden="true">
    {#each cables as cable (cable.id)}
      {@const fromCenter = getJackCenter(cable.from, modules, dragState)}
      {@const toCenter = getJackCenter(cable.to, modules, dragState)}
      {@const cablePath = fromCenter && toCenter ? buildCablePath(fromCenter, toCenter) : null}
      {@const handlePoint = fromCenter && toCenter ? cableHandlePoint(fromCenter, toCenter) : null}
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
          on:pointerdown={(event) => handleCablePointerDown(event, cable.id)}
          on:click={(event) => handleCableClick(event, cable.id)}
          on:contextmenu={(event) => handleCableContextMenu(event, cable.id)}
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
        {#if handlePoint}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <circle
            class:cable-focused={cableIsFocused}
            class="cable-midpoint-handle"
            cx={handlePoint.x}
            cy={handlePoint.y}
            r={7}
            data-cable-id={cable.id}
            on:pointerenter={() => {
              hoveredCableId = cable.id;
            }}
            on:pointerleave={() => {
              if (hoveredCableId === cable.id) {
                hoveredCableId = null;
              }
            }}
            on:pointerdown={(event) => handleCablePointerDown(event, cable.id)}
            on:click={(event) => handleCableClick(event, cable.id)}
            on:contextmenu={(event) => handleCableContextMenu(event, cable.id)}
          />
        {/if}
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
      {@const fromCenter = getJackCenter(wiringState.from, modules, dragState)}
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
          {@const isGroupDragging = Boolean(dragState?.groupIds.includes(module.id))}
          {@const isDragPlacementValid =
            !isDraggingSource || canPlaceModule(module.id, module.rackIndex, module.xHp)}
          <div
            class="module"
            class:selected={selectedId === module.id || selectedModuleIds.includes(module.id)}
            class:drag-source={isGroupDragging}
            class:invalid-drag={isDraggingSource && !isDragPlacementValid}
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
                return;
              }
              openModuleKeyboardMenu(module, event);
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

  <svg class="cable-handle-layer" aria-hidden="true">
    {#each cables as cable (cable.id)}
      {@const fromCenter = getJackCenter(cable.from, modules, dragState)}
      {@const toCenter = getJackCenter(cable.to, modules, dragState)}
      {@const handlePoint = fromCenter && toCenter ? cableHandlePoint(fromCenter, toCenter) : null}
      {@const cableIsFocused = selectedCableId === cable.id || hoveredCableId === cable.id}
      {#if fromCenter && toCenter && handlePoint}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <circle
          class:cable-focused={cableIsFocused}
          class="cable-midpoint-handle"
          cx={handlePoint.x}
          cy={handlePoint.y}
          r={7}
          data-cable-id={cable.id}
          on:pointerenter={() => {
            hoveredCableId = cable.id;
          }}
          on:pointerleave={() => {
            if (hoveredCableId === cable.id) {
              hoveredCableId = null;
            }
          }}
          on:pointerdown={(event) => handleCablePointerDown(event, cable.id)}
          on:click={(event) => handleCableClick(event, cable.id)}
          on:contextmenu={(event) => handleCableContextMenu(event, cable.id)}
        />
      {/if}
      {#if selectedCableId === cable.id && fromCenter && toCenter}
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
    {/each}
  </svg>
</div>
