import createCoreModule from './wasmod-core.js';

function formatValue(value) {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(2);
}

export async function createWasmodWasmEngine() {
  await createCoreModule();
  let audioContext = null;
  let workletNode = null;
  let meterListeners = new Set();
  let masterVolume = 0.8;

  const ensureAudio = async () => {
    if (audioContext && workletNode) {
      console.log('[WasMod Engine] Audio already initialized');
      return;
    }

    console.log('[WasMod Engine] Creating AudioContext...');
    audioContext = new AudioContext({ latencyHint: 'interactive' });
    console.log('[WasMod Engine] AudioContext created, sample rate:', audioContext.sampleRate);
    console.log('[WasMod Engine] Loading worklet module...');
    await audioContext.audioWorklet.addModule('/wasm/wasmod-worklet.js');
    console.log('[WasMod Engine] Worklet module loaded');
    workletNode = new AudioWorkletNode(audioContext, 'wasmod-worklet', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    console.log('[WasMod Engine] Worklet node created');
    workletNode.connect(audioContext.destination);
    console.log('[WasMod Engine] Worklet connected to destination');
    workletNode.port.onmessage = (event) => {
      if (event.data?.type === 'meter') {
        meterListeners.forEach((listener) => listener(event.data.value));
      }
    };
    workletNode.port.postMessage({ type: 'masterVolume', value: masterVolume });
    console.log('[WasMod Engine] Audio setup complete');
  };

  const postMessage = (message) => {
    if (!workletNode) {
      console.warn('[WasMod Engine] postMessage called but workletNode is null:', message);
      return;
    }
    console.log('[WasMod Engine] postMessage:', message.type, message);
    workletNode.port.postMessage(message);
  };

  return {
    ready: true,
    backend: 'wasm',
    setParameter(moduleId, paramName, value) {
      console.log(`[WasMod Engine] setParameter: ${moduleId}.${paramName} = ${formatValue(value)}`);
      // Ensure audio is ready before sending parameters
      ensureAudio().then(() => {
        postMessage({ type: 'setParameter', moduleId, paramName, value });
      });

      return {
        text: `> WASM.setParameter("${moduleId}.${paramName}", ${formatValue(value)})`,
        level: 'info'
      };
    },
    connect(from, to) {
      console.log(`[WasMod Engine] connect: ${from.moduleId}.${from.jackName} -> ${to.moduleId}.${to.jackName}`);
      // Ensure audio is ready before connecting
      ensureAudio().then(() => {
        postMessage({ type: 'connect', from, to });
      });

      return {
        text: `> WASM.connect("${from.moduleId}.${from.jackName}" -> "${to.moduleId}.${to.jackName}")`,
        level: 'success'
      };
    },
    disconnect(cableId) {
      console.log(`[WasMod Engine] disconnect: ${cableId}`);
      postMessage({ type: 'disconnect', cableId });
      return {
        text: `> WASM.disconnect("${cableId}")`,
        level: 'warning'
      };
    },
    async start() {
      console.log('[WasMod Engine] Starting audio...');
      await ensureAudio();
      await audioContext.resume();
      postMessage({ type: 'start' });
      console.log('[WasMod Engine] Audio started');
    },
    async stop() {
      console.log('[WasMod Engine] Stopping audio...');
      if (!audioContext) {
        return;
      }
      postMessage({ type: 'stop' });
      await audioContext.suspend();
      meterListeners.forEach((listener) => listener(0));
      console.log('[WasMod Engine] Audio stopped');
    },
    setMasterVolume(value) {
      masterVolume = value;
      postMessage({ type: 'masterVolume', value });
    },
    subscribeMeter(listener) {
      meterListeners.add(listener);
      return () => {
        meterListeners.delete(listener);
      };
    },
    async destroy() {
      if (audioContext) {
        postMessage({ type: 'stop' });
        await audioContext.close();
      }
      meterListeners.clear();
      audioContext = null;
      workletNode = null;
    }
  };
}
