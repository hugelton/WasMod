#include <cmath>
#include <string_view>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

namespace {

constexpr float kSampleRate = 48000.0f;
constexpr float kTwoPi = 6.28318530717958647692f;

struct VcoState {
  float pitch = 0.0f;
  float cv = 0.0f;
  float phase = 0.0f;
};

struct EngineState {
  float sample_rate = kSampleRate;
  VcoState vco;
  int speaker_connection_count = 0;
};

float nextSine(EngineState& engine) {
  VcoState& vco = engine.vco;
  const float pitch = vco.pitch + vco.cv;
  const float tunedFrequency = std::max(20.0f, 261.625565f * std::pow(2.0f, pitch));
  const float increment = tunedFrequency / engine.sample_rate;
  vco.phase += increment;
  if (vco.phase >= 1.0f) {
    vco.phase -= 1.0f;
  }
  return std::sin(vco.phase * kTwoPi);
}

}

extern "C" {

EMSCRIPTEN_KEEPALIVE EngineState* wasmod_create_engine() {
  return new EngineState();
}

EMSCRIPTEN_KEEPALIVE void wasmod_destroy_engine(EngineState* engine) {
  delete engine;
}

EMSCRIPTEN_KEEPALIVE void wasmod_set_parameter(EngineState* engine, const char* module_id, const char* param_name, float value) {
  if (!engine || !module_id || !param_name) {
    return;
  }

  std::string_view module(module_id);
  std::string_view param(param_name);

  if (module.find("vco") != std::string_view::npos) {
    if (param == "Pitch") {
      engine->vco.pitch = value;
    }
  }
}

EMSCRIPTEN_KEEPALIVE void wasmod_connect(EngineState* engine, const char* from_module, const char* from_jack, const char* to_module, const char* to_jack) {
  if (!engine || !from_module || !from_jack || !to_module || !to_jack) {
    return;
  }

  std::string_view fromModule(from_module);
  std::string_view fromJack(from_jack);
  std::string_view toModule(to_module);
  std::string_view toJack(to_jack);

  const bool speakerTarget =
    (toModule.find("speaker") != std::string_view::npos && toJack == "audio_in") ||
    (fromModule.find("speaker") != std::string_view::npos && fromJack == "audio_in");

  if (speakerTarget) {
    engine->speaker_connection_count += 1;
  }
}

EMSCRIPTEN_KEEPALIVE void wasmod_disconnect(EngineState* engine, const char* /*cable_id*/) {
  if (!engine) {
    return;
  }

  if (engine->speaker_connection_count > 0) {
    engine->speaker_connection_count -= 1;
  }
}

EMSCRIPTEN_KEEPALIVE int wasmod_get_connection_count(EngineState* engine) {
  if (!engine) {
    return -1;
  }
  return engine->speaker_connection_count;
}

EMSCRIPTEN_KEEPALIVE void wasmod_set_sample_rate(EngineState* engine, float sample_rate) {
  if (!engine || sample_rate <= 1000.0f) {
    return;
  }
  engine->sample_rate = sample_rate;
}

EMSCRIPTEN_KEEPALIVE void wasmod_process_block(EngineState* engine, float* output, int frame_count) {
  if (!engine || !output || frame_count <= 0) {
    return;
  }

  for (int frame = 0; frame < frame_count; ++frame) {
    const float vcoSample = engine->speaker_connection_count > 0 ? nextSine(*engine) : 0.0f;
    output[frame] = vcoSample * 0.18f;
  }
}

}
