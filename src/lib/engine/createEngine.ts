import type { WasmodEngine } from '../types';
import { createMockEngine } from './mockEngine';

const isDev = import.meta.env.DEV;

export async function createWasmodEngine(): Promise<WasmodEngine> {
  if (isDev) {
    console.info('[WasMod] Initializing engine...');
  }
  try {
    const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<Record<string, unknown>>;
    if (isDev) {
      console.info('[WasMod] Loading WASM loader from /wasm/wasmod-engine.js');
    }
    const loader = await dynamicImport('/wasm/wasmod-engine.js');
    if (typeof loader.createWasmodWasmEngine === 'function') {
      const engine = await loader.createWasmodWasmEngine();
      if (isDev) {
        console.info('[WasMod] WASM engine created successfully, backend:', engine.backend);
      }
      return engine;
    }
  } catch (error) {
    console.warn('[WasMod] WASM loading failed, falling back to mock engine:', error);
    // The generated WASM bundle is optional during the frontend bring-up phase.
  }

  if (isDev) {
    console.info('[WasMod] Using mock engine');
  }
  return createMockEngine();
}
