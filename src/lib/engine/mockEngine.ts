import type { CableEndpoint, EngineLogEntry, WasmodEngine } from '../types';

function formatValue(value: number) {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(2);
}

class MockWasmodEngine implements WasmodEngine {
  ready = false;
  backend: 'mock' | 'wasm' = 'mock';
  masterVolume = 0.8;
  meterTimer: number | null = null;
  listeners = new Set<(value: number) => void>();

  setParameter(moduleId: string, paramName: string, value: number): EngineLogEntry {
    return {
      text: `> MOCK.setParameter("${moduleId}.${paramName}", ${formatValue(value)})`,
      level: 'info'
    };
  }

  connect(from: CableEndpoint, to: CableEndpoint): EngineLogEntry {
    return {
      text: `> MOCK.connect("${from.moduleId}.${from.jackName}" -> "${to.moduleId}.${to.jackName}")`,
      level: 'success'
    };
  }

  disconnect(cableId: string): EngineLogEntry {
    return {
      text: `> MOCK.disconnect("${cableId}")`,
      level: 'warning'
    };
  }

  async start() {
    if (this.meterTimer !== null) {
      return;
    }
    this.meterTimer = window.setInterval(() => {
      const value = 0.15 + Math.random() * 0.35 * this.masterVolume;
      this.listeners.forEach((listener) => listener(value));
    }, 80);
  }

  async stop() {
    if (this.meterTimer !== null) {
      window.clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
    this.listeners.forEach((listener) => listener(0));
  }

  setMasterVolume(value: number) {
    this.masterVolume = value;
  }

  subscribeMeter(listener: (value: number) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async destroy() {
    await this.stop();
    this.listeners.clear();
  }
}

export function createMockEngine(): WasmodEngine {
  return new MockWasmodEngine();
}
