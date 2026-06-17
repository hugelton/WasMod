// Global flag to prevent module drag during control interaction
let activeControlPointerId: number | null = null;

type AutoBindModuleOptions = {
  onParameterChange: (paramName: string, value: number) => void;
  disabled?: boolean;
};

type Cleanup = () => void;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatValue(value: number) {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(2);
}

function formatSwitchValue(value: number) {
  return String(Math.round(value));
}

export function autoBindModule(node: SVGSVGElement, options: AutoBindModuleOptions) {
  let currentOptions = options;
  const cleanups: Cleanup[] = [];

  function updateDisplays(paramName: string, value: number) {
    const displays = node.querySelectorAll<SVGTextElement>(`.param-display[data-target="${paramName}"]`);
    displays.forEach((display) => {
      display.textContent = formatValue(value);
    });
  }

  function bindKnobs() {
    const knobs = node.querySelectorAll<SVGGElement>('.wm__knob');

    knobs.forEach((knob) => {
      const min = Number(knob.dataset.min ?? 0);
      const max = Number(knob.dataset.max ?? 1);
      const paramName = knob.dataset.name ?? 'Param';
      const graphic = knob.querySelector<SVGGraphicsElement>('.knob-graphic');
      if (!graphic) {
        return;
      }

      const minAngle = -135;
      const maxAngle = 135;
      const angleRange = maxAngle - minAngle;
      const valueToAngle = (value: number) => minAngle + ((value - min) / (max - min)) * angleRange;
      const step = Number(knob.dataset.step ?? 0);
      const resetValue = Number(knob.dataset.resetValue ?? knob.dataset.value ?? min);

      let value = Number(knob.dataset.value ?? min);
      let currentAngle = valueToAngle(value);
      let isDragging = false;
      let dragStartY = 0;
      let dragStartValue = value;
      let activePointerId: number | null = null;
      let isMouseDragging = false;
      let popoverTimer: number | null = null;
      const popover = document.createElement('div');
      popover.className = 'knob-value-popover';
      popover.setAttribute('role', 'status');
      document.body.appendChild(popover);

      const positionPopover = () => {
        const rect = knob.getBoundingClientRect();
        popover.style.left = `${rect.left + rect.width / 2}px`;
        popover.style.top = `${rect.top - 10}px`;
      };

      const hidePopover = () => {
        popover.classList.remove('visible');
      };

      const showPopover = () => {
        popover.textContent = formatValue(value);
        positionPopover();
        popover.classList.add('visible');
        if (popoverTimer !== null) {
          window.clearTimeout(popoverTimer);
        }
        popoverTimer = window.setTimeout(hidePopover, 850);
      };

      const commitValue = (nextValue: number, reveal = false) => {
        const steppedValue = step > 0 ? Math.round(nextValue / step) * step : nextValue;
        value = clamp(steppedValue, min, max);
        currentAngle = valueToAngle(value);
        graphic.setAttribute('transform', `rotate(${currentAngle})`);
        knob.dataset.value = String(value);
        knob.setAttribute('aria-valuenow', formatValue(value));
        updateDisplays(paramName, value);
        currentOptions.onParameterChange(paramName, value);
        if (reveal) {
          showPopover();
        }
      };

      knob.setAttribute('role', 'slider');
      knob.setAttribute('tabindex', '0');
      knob.setAttribute('aria-label', paramName);
      knob.setAttribute('aria-valuemin', String(min));
      knob.setAttribute('aria-valuemax', String(max));
      commitValue(value);

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        dragStartY = event.clientY;
        dragStartValue = value;
        activePointerId = event.pointerId;
        activeControlPointerId = event.pointerId;
        showPopover();
        window.addEventListener('pointermove', onPointerMove, { capture: true });
        window.addEventListener('pointerup', onPointerUp, { capture: true });
        window.addEventListener('pointercancel', onPointerUp, { capture: true });
      };

      const beginMouseDrag = (event: MouseEvent) => {
        if (activePointerId !== null) {
          return;
        }
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        isMouseDragging = true;
        dragStartY = event.clientY;
        dragStartValue = value;
        activeControlPointerId = -1;
        showPopover();
        window.addEventListener('mousemove', onMouseMove, { capture: true });
        window.addEventListener('mouseup', onMouseUp, { capture: true });
      };

      const moveDrag = (clientY: number, fine: boolean) => {
        const range = max - min;
        const sensitivity = fine ? 0.002 : 0.01;
        const delta = (dragStartY - clientY) * range * sensitivity;
        commitValue(dragStartValue + delta, true);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isDragging || activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        moveDrag(event.clientY, event.shiftKey);
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!isDragging || !isMouseDragging) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        moveDrag(event.clientY, event.shiftKey);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        activePointerId = null;
        activeControlPointerId = null;
        window.removeEventListener('pointermove', onPointerMove, { capture: true });
        window.removeEventListener('pointerup', onPointerUp, { capture: true });
        window.removeEventListener('pointercancel', onPointerUp, { capture: true });
      };

      const onMouseUp = (event: MouseEvent) => {
        if (!isMouseDragging) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        isMouseDragging = false;
        activeControlPointerId = null;
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        window.removeEventListener('mouseup', onMouseUp, { capture: true });
      };

      const onDoubleClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        commitValue(resetValue, true);
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const range = max - min;
        const wheelStep = event.shiftKey ? range / 600 : range / 120;
        commitValue(value - Math.sign(event.deltaY) * wheelStep, true);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        const range = max - min;
        const keyboardStep = event.shiftKey ? range / 600 : range / 60;
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value + keyboardStep, true);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value - keyboardStep, true);
        } else if (event.key === 'Home') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(min, true);
        } else if (event.key === 'End') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(max, true);
        } else if (event.key === '0' || event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(resetValue, true);
        }
      };

      knob.addEventListener('pointerdown', onPointerDown, { capture: true });
      knob.addEventListener('mousedown', beginMouseDrag, { capture: true });
      knob.addEventListener('dblclick', onDoubleClick, { capture: true });
      knob.addEventListener('contextmenu', onDoubleClick, { capture: true });
      knob.addEventListener('wheel', onWheel, { capture: true, passive: false });
      knob.addEventListener('keydown', onKeyDown, { capture: true });

      cleanups.push(() => {
        if (popoverTimer !== null) {
          window.clearTimeout(popoverTimer);
        }
        popover.remove();
        knob.removeEventListener('pointerdown', onPointerDown, { capture: true });
        knob.removeEventListener('mousedown', beginMouseDrag, { capture: true });
        knob.removeEventListener('dblclick', onDoubleClick, { capture: true });
        knob.removeEventListener('contextmenu', onDoubleClick, { capture: true });
        knob.removeEventListener('wheel', onWheel, { capture: true });
        knob.removeEventListener('keydown', onKeyDown, { capture: true });
        window.removeEventListener('pointermove', onPointerMove, { capture: true });
        window.removeEventListener('pointerup', onPointerUp, { capture: true });
        window.removeEventListener('pointercancel', onPointerUp, { capture: true });
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        window.removeEventListener('mouseup', onMouseUp, { capture: true });
      });
    });
  }

  function bindFaders() {
    const faders = node.querySelectorAll<SVGGElement>('.wm__fader');

    faders.forEach((fader) => {
      const min = Number(fader.dataset.min ?? 0);
      const max = Number(fader.dataset.max ?? 1);
      const step = Number(fader.dataset.step ?? 0.01);
      const paramName = fader.dataset.name ?? 'Fader';
      const cap = fader.querySelector<SVGGraphicsElement>('.fader-cap');
      if (!cap) {
        return;
      }

      const trackLength = Number(fader.dataset.trackLength ?? 100);
      const valueToY = (value: number) => trackLength - ((value - min) / (max - min)) * trackLength;
      const yToValue = (y: number) => min + ((trackLength - y) / trackLength) * (max - min);

      let value = Number(fader.dataset.value ?? min);
      let currentY = valueToY(value);
      let isDragging = false;
      let startMouseY = 0;
      let activePointerId: number | null = null;

      const syncCapPosition = () => {
        cap.setAttribute('transform', `translate(0, ${currentY})`);
        if (cap instanceof SVGRectElement) {
          cap.setAttribute('y', String(currentY));
        }
        fader.dataset.value = String(value);
        fader.setAttribute('aria-valuenow', formatValue(value));
        updateDisplays(paramName, value);
      };

      const commitValue = (nextValue: number) => {
        const steppedValue = step > 0 ? Math.round(nextValue / step) * step : nextValue;
        value = clamp(steppedValue, min, max);
        currentY = valueToY(value);
        syncCapPosition();
        currentOptions.onParameterChange(paramName, value);
      };

      fader.setAttribute('role', 'slider');
      fader.setAttribute('tabindex', '0');
      fader.setAttribute('aria-label', paramName);
      fader.setAttribute('aria-valuemin', String(min));
      fader.setAttribute('aria-valuemax', String(max));
      commitValue(value);

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        startMouseY = event.clientY;
        activePointerId = event.pointerId;
        activeControlPointerId = event.pointerId; // Set global flag
        cap.setPointerCapture?.(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isDragging || activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const deltaY = event.clientY - startMouseY;
        startMouseY = event.clientY;
        commitValue(yToValue(clamp(currentY + deltaY, 0, trackLength)));
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        activePointerId = null;
        activeControlPointerId = null; // Clear global flag
        cap.releasePointerCapture?.(event.pointerId);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value + step);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value - step);
        } else if (event.key === 'Home') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(min);
        } else if (event.key === 'End') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(max);
        }
      };

      cap.addEventListener('pointerdown', onPointerDown, { capture: true });
      cap.addEventListener('pointermove', onPointerMove, { capture: true });
      cap.addEventListener('pointerup', onPointerUp, { capture: true });
      cap.addEventListener('pointercancel', onPointerUp, { capture: true });
      fader.addEventListener('keydown', onKeyDown, { capture: true });

      cleanups.push(() => {
        cap.removeEventListener('pointerdown', onPointerDown, { capture: true });
        cap.removeEventListener('pointermove', onPointerMove, { capture: true });
        cap.removeEventListener('pointerup', onPointerUp, { capture: true });
        cap.removeEventListener('pointercancel', onPointerUp, { capture: true });
        fader.removeEventListener('keydown', onKeyDown, { capture: true });
      });
    });
  }

  function bindSwitches() {
    const switches = node.querySelectorAll<SVGGElement>('.wm__switch');

    switches.forEach((switchControl) => {
      const min = Number(switchControl.dataset.min ?? 0);
      const max = Number(switchControl.dataset.max ?? 1);
      const step = Number(switchControl.dataset.step ?? 1);
      const paramName = switchControl.dataset.name ?? 'Switch';
      const orientation = switchControl.dataset.orientation ?? 'vertical';
      const thumb = switchControl.querySelector<SVGGraphicsElement>('.switch-thumb');
      if (!thumb) {
        return;
      }

      const start = Number(switchControl.dataset.start ?? -6);
      const end = Number(switchControl.dataset.end ?? 6);
      const valueToOffset = (nextValue: number) => {
        const ratio = max === min ? 0 : (nextValue - min) / (max - min);
        return start + ratio * (end - start);
      };

      let value = Number(switchControl.dataset.value ?? min);

      const syncVisual = () => {
        const offset = valueToOffset(value);
        const transform = orientation === 'horizontal' ? `translate(${offset}, 0)` : `translate(0, ${offset})`;
        thumb.setAttribute('transform', transform);
        switchControl.dataset.value = String(value);
        switchControl.setAttribute('aria-valuenow', formatSwitchValue(value));
        updateDisplays(paramName, value);
      };

      const commitValue = (nextValue: number) => {
        const steppedValue = step > 0 ? Math.round(nextValue / step) * step : nextValue;
        value = clamp(steppedValue, min, max);
        syncVisual();
        currentOptions.onParameterChange(paramName, value);
      };

      const valueFromPointer = (event: PointerEvent | MouseEvent) => {
        const rect = switchControl.getBoundingClientRect();
        const ratio =
          orientation === 'horizontal'
            ? (event.clientX - rect.left) / rect.width
            : (event.clientY - rect.top) / rect.height;
        return min + clamp(ratio, 0, 1) * (max - min);
      };

      let isDragging = false;
      let activePointerId: number | null = null;

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        activePointerId = event.pointerId;
        activeControlPointerId = event.pointerId;
        commitValue(valueFromPointer(event));
        switchControl.setPointerCapture?.(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isDragging || activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        commitValue(valueFromPointer(event));
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        activePointerId = null;
        activeControlPointerId = null;
        switchControl.releasePointerCapture?.(event.pointerId);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value - step);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(value + step);
        } else if (event.key === 'Home') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(min);
        } else if (event.key === 'End') {
          event.preventDefault();
          event.stopPropagation();
          commitValue(max);
        }
      };

      switchControl.setAttribute('role', 'slider');
      switchControl.setAttribute('tabindex', '0');
      switchControl.setAttribute('aria-label', paramName);
      switchControl.setAttribute('aria-valuemin', String(min));
      switchControl.setAttribute('aria-valuemax', String(max));
      commitValue(value);

      switchControl.addEventListener('pointerdown', onPointerDown, { capture: true });
      switchControl.addEventListener('pointermove', onPointerMove, { capture: true });
      switchControl.addEventListener('pointerup', onPointerUp, { capture: true });
      switchControl.addEventListener('pointercancel', onPointerUp, { capture: true });
      switchControl.addEventListener('keydown', onKeyDown, { capture: true });

      cleanups.push(() => {
        switchControl.removeEventListener('pointerdown', onPointerDown, { capture: true });
        switchControl.removeEventListener('pointermove', onPointerMove, { capture: true });
        switchControl.removeEventListener('pointerup', onPointerUp, { capture: true });
        switchControl.removeEventListener('pointercancel', onPointerUp, { capture: true });
        switchControl.removeEventListener('keydown', onKeyDown, { capture: true });
      });
    });
  }

  function bindButtons() {
    const buttons = node.querySelectorAll<SVGGElement>('.wm__button, .wm__led_button');

    buttons.forEach((button) => {
      const type = button.dataset.type ?? 'momentary';
      const paramName = button.dataset.name ?? 'Button';
      const graphic = button.querySelector<SVGGraphicsElement>('.btn-graphic');
      const led = button.querySelector<SVGGraphicsElement>('.btn-led');
      let state = Number(button.dataset.state ?? 0);
      let isPressed = false;

      const syncVisual = () => {
        if (led) {
          led.setAttribute('opacity', state ? '1' : '0.2');
        } else if (graphic) {
          graphic.setAttribute('fill', state ? '#e4573d' : '#34495e');
        }
      };

      syncVisual();
      currentOptions.onParameterChange(paramName, state);

      const press = () => {
        if (graphic) {
          graphic.setAttribute('transform', 'scale(0.95)');
        }
      };

      const release = () => {
        if (graphic) {
          graphic.setAttribute('transform', 'scale(1)');
        }
      };

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isPressed = true;
        activeControlPointerId = event.pointerId; // Set global flag
        press();
        if (type === 'momentary') {
          currentOptions.onParameterChange(paramName, 1);
        }
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!isPressed) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        isPressed = false;
        activeControlPointerId = null; // Clear global flag
        release();

        if (type === 'momentary') {
          currentOptions.onParameterChange(paramName, 0);
          return;
        }

        state = state ? 0 : 1;
        button.dataset.state = String(state);
        syncVisual();
        currentOptions.onParameterChange(paramName, state);
      };

      button.addEventListener('pointerdown', onPointerDown, { capture: true });
      button.addEventListener('pointerup', onPointerUp, { capture: true });
      button.addEventListener('pointercancel', onPointerUp, { capture: true });

      cleanups.push(() => {
        button.removeEventListener('pointerdown', onPointerDown, { capture: true });
        button.removeEventListener('pointerup', onPointerUp, { capture: true });
        button.removeEventListener('pointercancel', onPointerUp, { capture: true });
      });
    });
  }

  if (!currentOptions.disabled) {
    bindKnobs();
    bindFaders();
    bindSwitches();
    bindButtons();
  }

  return {
    update(nextOptions: AutoBindModuleOptions) {
      currentOptions = nextOptions;
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
    }
  };
}

// Export function to check if a control is being manipulated
export function isActiveControl(pointerId: number): boolean {
  return activeControlPointerId === pointerId;
}
