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
    this.core = await createCoreModule();
    this.engineHandle = this.core.ccall('wasmod_create_engine', 'number', [], []);
    this.core.ccall('wasmod_set_sample_rate', null, ['number', 'number'], [this.engineHandle, sampleRate]);
    this.ready = true;
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
    if (message?.type === 'start') {
      this.playing = true;
      return;
    }

    if (message?.type === 'stop') {
      this.playing = false;
      return;
    }

    if (message?.type === 'masterVolume') {
      this.masterVolume = message.value;
      return;
    }

    if (!this.ready || !this.core || !this.engineHandle) {
      return;
    }

    if (message?.type === 'setParameter') {
      this.core.ccall(
        'wasmod_set_parameter',
        null,
        ['number', 'string', 'string', 'number'],
        [this.engineHandle, message.moduleId, message.paramName, message.value]
      );
      return;
    }

    if (message?.type === 'connect') {
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
      return;
    }

    if (message?.type === 'disconnect') {
      this.core.ccall('wasmod_disconnect', null, ['number', 'string'], [this.engineHandle, message.cableId]);
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
    }

    return true;
  }
}

registerProcessor('wasmod-worklet', WasmodWorkletProcessor);
