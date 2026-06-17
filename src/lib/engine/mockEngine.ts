import type { CableEndpoint, EngineLogEntry, WasmodEngine, WasmodEngineDiagnostics } from '../types';

function formatValue(value: number) {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(2);
}

class MockWasmodEngine implements WasmodEngine {
  ready = false;
  backend: 'mock' | 'wasm' = 'mock';
  masterVolume = 0.8;
  meterTimer: number | null = null;
  listeners = new Set<(value: number) => void>();
  diagnosticsListeners = new Set<(value: WasmodEngineDiagnostics) => void>();

  emitDiagnostics(patch: Partial<WasmodEngineDiagnostics> = {}) {
    const state: WasmodEngineDiagnostics = {
      playing: this.meterTimer !== null,
      ready: true,
      connectionCount: 0,
      peak: 0,
      audioHealthy: true,
      ...patch
    };
    this.diagnosticsListeners.forEach((listener) => listener(state));
  }

  setParameter(moduleId: string, paramName: string, value: number): EngineLogEntry {
    return {
      text: `> MOCK.setParameter("${moduleId}.${paramName}", ${formatValue(value)})`,
      level: 'info'
    };
  }

  setConnections() {
    this.emitDiagnostics({ connectionCount: 0 });
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
    this.emitDiagnostics({ playing: true });
    this.meterTimer = window.setInterval(() => {
      const value = 0.15 + Math.random() * 0.35 * this.masterVolume;
      this.listeners.forEach((listener) => listener(value));
      this.emitDiagnostics({ playing: true, peak: value });
    }, 80);
  }

  async stop() {
    if (this.meterTimer !== null) {
      window.clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
    this.listeners.forEach((listener) => listener(0));
    this.emitDiagnostics({ playing: false, peak: 0 });
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

  subscribeDiagnostics(listener: (value: WasmodEngineDiagnostics) => void) {
    this.diagnosticsListeners.add(listener);
    listener({
      playing: this.meterTimer !== null,
      ready: true,
      connectionCount: 0,
      peak: 0,
      audioHealthy: true
    });
    return () => {
      this.diagnosticsListeners.delete(listener);
    };
  }

  async destroy() {
    await this.stop();
    this.listeners.clear();
    this.diagnosticsListeners.clear();
  }
}

export function createMockEngine(): WasmodEngine {
  return new MockWasmodEngine();
}
