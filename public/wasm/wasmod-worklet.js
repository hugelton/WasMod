import createCoreModule from './wasmod-core.js';

class WasmodWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = null;
    this.engineHandle = 0;
    this.bufferPtr = 0;
    this.bufferFrames = 0;
    this.ready = false;
    this.playing = false;
    this.masterVolume = 0.8;
    this.meterCounter = 0;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.init();
  }

  async init() {
    console.log('[Wasmod Worklet] Initializing core module...');
    this.core = await createCoreModule();
    console.log('[Wasmod Worklet] Core module loaded');
    this.engineHandle = this.core.ccall('wasmod_create_engine', 'number', [], []);
    console.log('[Wasmod Worklet] Engine created, handle:', this.engineHandle);
    this.core.ccall('wasmod_set_sample_rate', null, ['number', 'number'], [this.engineHandle, sampleRate]);
    console.log('[Wasmod Worklet] Sample rate set to', sampleRate);
    this.ready = true;
    console.log('[Wasmod Worklet] Initialization complete');
  }

  ensureBuffer(frameCount) {
    if (!this.core) {
      return;
    }
    if (this.bufferFrames === frameCount && this.bufferPtr) {
      return;
    }
    if (this.bufferPtr) {
      this.core._free(this.bufferPtr);
    }
    this.bufferFrames = frameCount;
    this.bufferPtr = this.core._malloc(frameCount * Float32Array.BYTES_PER_ELEMENT);
  }

  handleMessage(message) {
    console.log('[Wasmod Worklet] handleMessage:', message?.type, message);

    if (message?.type === 'start') {
      console.log('[Wasmod Worklet] Starting playback, playing = true');
      this.playing = true;
      return;
    }

    if (message?.type === 'stop') {
      console.log('[Wasmod Worklet] Stopping playback, playing = false');
      this.playing = false;
      return;
    }

    if (message?.type === 'masterVolume') {
      this.masterVolume = message.value;
      console.log('[Wasmod Worklet] Master volume set to', message.value);
      return;
    }

    if (!this.ready || !this.core || !this.engineHandle) {
      console.warn('[Wasmod Worklet] Message received but not ready:', message?.type);
      return;
    }

    if (message?.type === 'setParameter') {
      console.log('[Wasmod Worklet] setParameter:', message.moduleId, message.paramName, message.value);
      this.core.ccall(
        'wasmod_set_parameter',
        null,
        ['number', 'string', 'string', 'number'],
        [this.engineHandle, message.moduleId, message.paramName, message.value]
      );
      return;
    }

    if (message?.type === 'connect') {
      console.log('[Wasmod Worklet] connect:', message.from.moduleId, message.from.jackName, '->', message.to.moduleId, message.to.jackName);
      this.core.ccall(
        'wasmod_connect',
        null,
        ['number', 'string', 'string', 'string', 'string'],
        [
          this.engineHandle,
          message.from.moduleId,
          message.from.jackName,
          message.to.moduleId,
          message.to.jackName
        ]
      );
      const count = this.core.ccall('wasmod_get_connection_count', 'number', ['number'], [this.engineHandle]);
      console.log('[Wasmod Worklet] Connection count after connect:', count);
      return;
    }

    if (message?.type === 'disconnect') {
      console.log('[Wasmod Worklet] disconnect:', message.cableId);
      this.core.ccall('wasmod_disconnect', null, ['number', 'string'], [this.engineHandle, message.cableId]);
      const count = this.core.ccall('wasmod_get_connection_count', 'number', ['number'], [this.engineHandle]);
      console.log('[Wasmod Worklet] Connection count after disconnect:', count);
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) {
      return true;
    }

    const left = output[0];
    const right = output[1] ?? output[0];
    const frameCount = left.length;

    if (!this.ready || !this.playing || !this.core || !this.engineHandle) {
      left.fill(0);
      right.fill(0);
      if (!this.ready) {
        console.warn('[Wasmod Worklet] Process called but not ready');
      }
      return true;
    }

    this.ensureBuffer(frameCount);
    this.core.ccall('wasmod_process_block', null, ['number', 'number', 'number'], [this.engineHandle, this.bufferPtr, frameCount]);

    const mono = this.core.HEAPF32.subarray(
      this.bufferPtr / Float32Array.BYTES_PER_ELEMENT,
      this.bufferPtr / Float32Array.BYTES_PER_ELEMENT + frameCount
    );

    let peak = 0;
    for (let i = 0; i < frameCount; i += 1) {
      const sample = mono[i] * this.masterVolume;
      left[i] = sample;
      right[i] = sample;
      const abs = Math.abs(sample);
      if (abs > peak) {
        peak = abs;
      }
    }

    this.meterCounter += 1;
    if (this.meterCounter >= 4) {
      this.port.postMessage({ type: 'meter', value: peak });
      this.meterCounter = 0;

      // Log connection count periodically (every ~4th meter update = ~320ms at 128 frames)
      if (this.meterCounter === 0) {
        const count = this.core.ccall('wasmod_get_connection_count', 'number', ['number'], [this.engineHandle]);
        console.log('[Wasmod Worklet] Connection count:', count, 'Peak:', peak);
      }
    }

    return true;
  }
}

registerProcessor('wasmod-worklet', WasmodWorkletProcessor);
