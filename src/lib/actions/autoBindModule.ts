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
      const angleToValue = (angle: number) => min + ((angle - minAngle) / angleRange) * (max - min);

      let value = Number(knob.dataset.value ?? min);
      let currentAngle = valueToAngle(value);
      let isDragging = false;
      let startY = 0;
      let activePointerId: number | null = null;

      graphic.setAttribute('transform', `rotate(${currentAngle})`);
      updateDisplays(paramName, value);
      currentOptions.onParameterChange(paramName, value);

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        startY = event.clientY;
        activePointerId = event.pointerId;
        knob.setPointerCapture?.(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isDragging || activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const deltaY = startY - event.clientY;
        startY = event.clientY;
        currentAngle = clamp(currentAngle + deltaY * 1.5, minAngle, maxAngle);
        value = clamp(angleToValue(currentAngle), min, max);

        graphic.setAttribute('transform', `rotate(${currentAngle})`);
        knob.dataset.value = String(value);
        updateDisplays(paramName, value);
        currentOptions.onParameterChange(paramName, value);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        activePointerId = null;
        knob.releasePointerCapture?.(event.pointerId);
      };

      knob.addEventListener('pointerdown', onPointerDown);
      knob.addEventListener('pointermove', onPointerMove);
      knob.addEventListener('pointerup', onPointerUp);
      knob.addEventListener('pointercancel', onPointerUp);

      cleanups.push(() => {
        knob.removeEventListener('pointerdown', onPointerDown);
        knob.removeEventListener('pointermove', onPointerMove);
        knob.removeEventListener('pointerup', onPointerUp);
        knob.removeEventListener('pointercancel', onPointerUp);
      });
    });
  }

  function bindFaders() {
    const faders = node.querySelectorAll<SVGGElement>('.wm__fader');

    faders.forEach((fader) => {
      const min = Number(fader.dataset.min ?? 0);
      const max = Number(fader.dataset.max ?? 1);
      const paramName = fader.dataset.name ?? 'Fader';
      const cap = fader.querySelector<SVGGraphicsElement>('.fader-cap');
      if (!cap) {
        return;
      }

      const trackLength = 100;
      const valueToY = (value: number) => trackLength - ((value - min) / (max - min)) * trackLength;
      const yToValue = (y: number) => min + ((trackLength - y) / trackLength) * (max - min);

      let value = Number(fader.dataset.value ?? min);
      let currentY = valueToY(value);
      let isDragging = false;
      let startMouseY = 0;
      let activePointerId: number | null = null;

      cap.setAttribute('y', String(currentY));
      updateDisplays(paramName, value);
      currentOptions.onParameterChange(paramName, value);

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        startMouseY = event.clientY;
        activePointerId = event.pointerId;
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
        currentY = clamp(currentY + deltaY, 0, trackLength);
        value = clamp(yToValue(currentY), min, max);

        cap.setAttribute('y', String(currentY));
        fader.dataset.value = String(value);
        updateDisplays(paramName, value);
        currentOptions.onParameterChange(paramName, value);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
        activePointerId = null;
        cap.releasePointerCapture?.(event.pointerId);
      };

      cap.addEventListener('pointerdown', onPointerDown);
      cap.addEventListener('pointermove', onPointerMove);
      cap.addEventListener('pointerup', onPointerUp);
      cap.addEventListener('pointercancel', onPointerUp);

      cleanups.push(() => {
        cap.removeEventListener('pointerdown', onPointerDown);
        cap.removeEventListener('pointermove', onPointerMove);
        cap.removeEventListener('pointerup', onPointerUp);
        cap.removeEventListener('pointercancel', onPointerUp);
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

      button.addEventListener('pointerdown', onPointerDown);
      button.addEventListener('pointerup', onPointerUp);
      button.addEventListener('pointercancel', onPointerUp);

      cleanups.push(() => {
        button.removeEventListener('pointerdown', onPointerDown);
        button.removeEventListener('pointerup', onPointerUp);
        button.removeEventListener('pointercancel', onPointerUp);
      });
    });
  }

  if (!currentOptions.disabled) {
    bindKnobs();
    bindFaders();
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
