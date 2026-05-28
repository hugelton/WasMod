import createCoreModule from './wasmod-core.js';

function formatValue(value) {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(2);
}

export async function createWasmodWasmEngine() {
  let audioContext = null;
  let processorNode = null;
  let core = null;
  let engineHandle = 0;
  let bufferPtr = 0;
  let bufferFrames = 0;
  let meterCounter = 0;
  let isReady = false;
  let isPlaying = false;
  let masterVolume = 0.8;

  const meterListeners = new Set();
  const diagnosticsListeners = new Set();
  const parameterState = new Map();
  const connectionState = new Map();

  let lastDiagnostics = {
    playing: false,
    ready: false,
    connectionCount: 0,
    peak: 0
  };

  const emitDiagnostics = (patch = {}) => {
    lastDiagnostics = {
      ...lastDiagnostics,
      ...patch
    };
    diagnosticsListeners.forEach((listener) => listener(lastDiagnostics));
  };

  const connectionKey = (from, to) =>
    `${from.moduleId}:${from.jackName}:${from.role}->${to.moduleId}:${to.jackName}:${to.role}`;

  const setConnectionState = (cables) => {
    connectionState.clear();
    cables.forEach((cable) => {
      connectionState.set(connectionKey(cable.from, cable.to), {
        from: cable.from,
        to: cable.to
      });
    });
  };

  const getConnectionCount = () => {
    if (!core || !engineHandle) {
      return 0;
    }
    return core.ccall('wasmod_get_connection_count', 'number', ['number'], [engineHandle]);
  };

  const ensureBuffer = (frameCount) => {
    if (!core) {
      return;
    }
    if (bufferFrames === frameCount && bufferPtr) {
      return;
    }
    if (bufferPtr) {
      core._free(bufferPtr);
    }
    bufferFrames = frameCount;
    bufferPtr = core._malloc(frameCount * Float32Array.BYTES_PER_ELEMENT);
  };

  const destroyEngineHandle = () => {
    if (core && engineHandle) {
      core.ccall('wasmod_destroy_engine', null, ['number'], [engineHandle]);
    }
    engineHandle = 0;
  };

  const createEngineHandle = () => {
    if (!core || !audioContext) {
      return false;
    }

    destroyEngineHandle();
    engineHandle = core.ccall('wasmod_create_engine', 'number', [], []);
    core.ccall('wasmod_set_sample_rate', null, ['number', 'number'], [engineHandle, audioContext.sampleRate]);
    return true;
  };

  const replayState = () => {
    if (!core || !engineHandle) {
      return;
    }

    parameterState.forEach((value, key) => {
      const [moduleId, paramName] = key.split('::');
      core.ccall(
        'wasmod_set_parameter',
        null,
        ['number', 'string', 'string', 'number'],
        [engineHandle, moduleId, paramName, value]
      );
    });

    connectionState.forEach(({ from, to }) => {
      core.ccall(
        'wasmod_connect',
        null,
        ['number', 'string', 'string', 'string', 'string'],
        [engineHandle, from.moduleId, from.jackName, to.moduleId, to.jackName]
      );
    });

    emitDiagnostics({
      ready: true,
      connectionCount: getConnectionCount()
    });
  };

  const syncRuntimeState = () => {
    if (!core || !audioContext) {
      return;
    }

    if (!createEngineHandle()) {
      return;
    }

    replayState();
  };

  const closeAudio = async () => {
    isPlaying = false;
    isReady = false;

    if (processorNode) {
      processorNode.disconnect();
      processorNode.onaudioprocess = null;
      processorNode = null;
    }

    if (bufferPtr && core) {
      core._free(bufferPtr);
    }
    bufferPtr = 0;
    bufferFrames = 0;

    destroyEngineHandle();

    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }

    emitDiagnostics({
      ready: false,
      playing: false,
      connectionCount: 0,
      peak: 0
    });
  };

  const ensureAudio = async (forceReset = false) => {
    if (forceReset) {
      await closeAudio();
    }

    if (audioContext && processorNode && core && engineHandle) {
      return;
    }

    audioContext = new AudioContext({ latencyHint: 'interactive' });
    core = await createCoreModule();
    createEngineHandle();

    processorNode = audioContext.createScriptProcessor(256, 0, 2);
    processorNode.onaudioprocess = (event) => {
      const left = event.outputBuffer.getChannelData(0);
      const right = event.outputBuffer.getChannelData(1);
      const frameCount = left.length;

      if (!isReady || !isPlaying || !core || !engineHandle) {
        left.fill(0);
        right.fill(0);
        return;
      }

      ensureBuffer(frameCount);
      core.ccall('wasmod_process_block', null, ['number', 'number', 'number'], [engineHandle, bufferPtr, frameCount]);

      const mono = core.HEAPF32.subarray(
        bufferPtr / Float32Array.BYTES_PER_ELEMENT,
        bufferPtr / Float32Array.BYTES_PER_ELEMENT + frameCount
      );

      let peak = 0;
      for (let i = 0; i < frameCount; i += 1) {
        const sample = mono[i] * masterVolume;
        left[i] = sample;
        right[i] = sample;
        const abs = Math.abs(sample);
        if (abs > peak) {
          peak = abs;
        }
      }

      meterCounter += 1;
      if (meterCounter >= 4) {
        meterListeners.forEach((listener) => listener(peak));
        emitDiagnostics({
          ready: true,
          playing: isPlaying,
          connectionCount: getConnectionCount(),
          peak
        });
        meterCounter = 0;
      }
    };

    processorNode.connect(audioContext.destination);
    isReady = true;
    emitDiagnostics({
      ready: true,
      playing: false,
      connectionCount: 0,
      peak: 0
    });
  };

  return {
    ready: true,
    backend: 'wasm',
    setParameter(moduleId, paramName, value) {
      parameterState.set(`${moduleId}::${paramName}`, value);
      if (core && engineHandle) {
        core.ccall(
          'wasmod_set_parameter',
          null,
          ['number', 'string', 'string', 'number'],
          [engineHandle, moduleId, paramName, value]
        );
      }

      return {
        text: `> WASM.setParameter("${moduleId}.${paramName}", ${formatValue(value)})`,
        level: 'info'
      };
    },
    setConnections(cables) {
      setConnectionState(cables);
      syncRuntimeState();
      emitDiagnostics({ connectionCount: getConnectionCount() });
    },
    connect(from, to) {
      connectionState.set(connectionKey(from, to), { from, to });
      syncRuntimeState();

      return {
        text: `> WASM.connect("${from.moduleId}.${from.jackName}" -> "${to.moduleId}.${to.jackName}")`,
        level: 'success'
      };
    },
    disconnect(cableId) {
      for (const [key, value] of connectionState.entries()) {
        if (cableId.includes(value.from.moduleId) && cableId.includes(value.to.moduleId)) {
          connectionState.delete(key);
        }
      }
      syncRuntimeState();

      return {
        text: `> WASM.disconnect("${cableId}")`,
        level: 'warning'
      };
    },
    async start() {
      await ensureAudio(true);
      replayState();
      await audioContext.resume();
      isPlaying = true;
      emitDiagnostics({
        ready: true,
        playing: true,
        connectionCount: getConnectionCount(),
        peak: 0
      });
    },
    async stop() {
      if (!audioContext) {
        return;
      }
      isPlaying = false;
      await audioContext.suspend();
      meterListeners.forEach((listener) => listener(0));
      emitDiagnostics({
        ready: isReady,
        playing: false,
        connectionCount: getConnectionCount(),
        peak: 0
      });
    },
    setMasterVolume(value) {
      masterVolume = value;
    },
    subscribeMeter(listener) {
      meterListeners.add(listener);
      return () => {
        meterListeners.delete(listener);
      };
    },
    subscribeDiagnostics(listener) {
      diagnosticsListeners.add(listener);
      listener(lastDiagnostics);
      return () => {
        diagnosticsListeners.delete(listener);
      };
    },
    async destroy() {
      await closeAudio();
      meterListeners.clear();
      diagnosticsListeners.clear();
    }
  };
}
