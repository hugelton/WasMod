import type { WasmodEngine } from '../types';
import { createMockEngine } from './mockEngine';

export async function createWasmodEngine(): Promise<WasmodEngine> {
  console.log('[WasMod] Initializing engine...');
  try {
    const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<Record<string, unknown>>;
    console.log('[Wasmod] Loading WASM loader from /wasm/wasmod-engine.js');
    const loader = await dynamicImport('/wasm/wasmod-engine.js');
    console.log('[Wasmod] WASM loader loaded:', typeof loader.createWasmodWasmEngine === 'function');
    if (typeof loader.createWasmodWasmEngine === 'function') {
      const engine = await loader.createWasmodWasmEngine();
      console.log('[WasMod] WASM engine created successfully, backend:', engine.backend);
      return engine;
    }
  } catch (error) {
    console.warn('[WasMod] WASM loading failed, falling back to mock engine:', error);
    // The generated WASM bundle is optional during the frontend bring-up phase.
  }

  console.log('[WasMod] Using mock engine');
  return createMockEngine();
}
