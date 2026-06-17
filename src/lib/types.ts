export type ModuleKind = 'blank2' | 'blank4' | 'blank6' | 'blank8' | 'blank12' | 'junction4' | 'vco4' | 'speaker4';

export type JackRole = 'input' | 'output' | 'both';

export interface ModuleCatalogEntry {
  kind: ModuleKind;
  name: string;
  hp: number;
  description: string;
  accent: string;
  moduleType: 'blank' | 'utility' | 'oscillator' | 'output';
}

export interface RackModuleInstance {
  id: string;
  kind: ModuleKind;
  hp: number;
  xHp: number;
  rackIndex: number;
}

export interface CableEndpoint {
  moduleId: string;
  jackName: string;
  role: JackRole;
}

export interface PatchCable {
  id: string;
  color: string;
  from: CableEndpoint;
  to: CableEndpoint;
}

export interface PendingCableConnection {
  from: CableEndpoint;
  to: CableEndpoint;
  replaceCableId?: string;
  replaceEndpoint?: 'from' | 'to';
}

export interface EngineLogEntry {
  text: string;
  level?: 'info' | 'success' | 'warning';
}

export interface WasmodEngineDiagnostics {
  playing: boolean;
  ready: boolean;
  connectionCount: number;
  peak: number;
  audioHealthy?: boolean;
  audioError?: string;
}

export interface WasmodEngine {
  ready: boolean;
  backend: 'mock' | 'wasm';
  setParameter(moduleId: string, paramName: string, value: number): EngineLogEntry;
  setConnections(cables: PatchCable[]): void;
  connect(from: CableEndpoint, to: CableEndpoint): EngineLogEntry;
  disconnect(cableId: string): EngineLogEntry;
  start(): Promise<void>;
  stop(): Promise<void>;
  setMasterVolume(value: number): void;
  subscribeMeter(listener: (value: number) => void): () => void;
  subscribeDiagnostics(listener: (value: WasmodEngineDiagnostics) => void): () => void;
  destroy(): Promise<void>;
}
