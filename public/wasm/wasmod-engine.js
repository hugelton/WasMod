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
      return;
    }

    audioContext = new AudioContext({ latencyHint: 'interactive' });
    await audioContext.audioWorklet.addModule('/wasm/wasmod-worklet.js');
    workletNode = new AudioWorkletNode(audioContext, 'wasmod-worklet', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    workletNode.connect(audioContext.destination);
    workletNode.port.onmessage = (event) => {
      if (event.data?.type === 'meter') {
        meterListeners.forEach((listener) => listener(event.data.value));
      }
    };
    workletNode.port.postMessage({ type: 'masterVolume', value: masterVolume });
  };

  const postMessage = (message) => {
    if (!workletNode) {
      return;
    }
    workletNode.port.postMessage(message);
  };

  return {
    ready: true,
    backend: 'wasm',
    setParameter(moduleId, paramName, value) {
      postMessage({ type: 'setParameter', moduleId, paramName, value });

      return {
        text: `> WASM.setParameter("${moduleId}.${paramName}", ${formatValue(value)})`,
        level: 'info'
      };
    },
    connect(from, to) {
      postMessage({ type: 'connect', from, to });

      return {
        text: `> WASM.connect("${from.moduleId}.${from.jackName}" -> "${to.moduleId}.${to.jackName}")`,
        level: 'success'
      };
    },
    disconnect(cableId) {
      return {
        text: `> WASM.disconnect("${cableId}")`,
        level: 'warning'
      };
    },
    async start() {
      await ensureAudio();
      await audioContext.resume();
      postMessage({ type: 'start' });
    },
    async stop() {
      if (!audioContext) {
        return;
      }
      postMessage({ type: 'stop' });
      await audioContext.suspend();
      meterListeners.forEach((listener) => listener(0));
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
