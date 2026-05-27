import type { WasmodEngine } from '../types';
import { createMockEngine } from './mockEngine';

export async function createWasmodEngine(): Promise<WasmodEngine> {
  try {
    const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<Record<string, unknown>>;
    const loader = await dynamicImport('/wasm/wasmod-engine.js');
    if (typeof loader.createWasmodWasmEngine === 'function') {
      return await loader.createWasmodWasmEngine();
    }
  } catch {
    // The generated WASM bundle is optional during the frontend bring-up phase.
  }

  return createMockEngine();
}
