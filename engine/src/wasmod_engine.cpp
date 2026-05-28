#include <cmath>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

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

struct ConnectionState {
  std::string from_module;
  std::string from_jack;
  std::string to_module;
  std::string to_jack;
};

struct EngineState {
  float sample_rate = kSampleRate;
  std::unordered_map<std::string, VcoState> vcos;
  std::vector<ConnectionState> connections;
};

bool isVcoModule(std::string_view module_id) {
  return module_id.find("vco") != std::string_view::npos;
}

bool isSpeakerInput(std::string_view module_id, std::string_view jack_name) {
  return module_id.find("speaker") != std::string_view::npos && jack_name == "audio_in";
}

VcoState& ensureVco(EngineState& engine, std::string_view module_id) {
  return engine.vcos[std::string(module_id)];
}

float nextSine(EngineState& engine, VcoState& vco) {
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

  if (!isVcoModule(module)) {
    return;
  }

  VcoState& vco = ensureVco(*engine, module);
  if (param == "Pitch") {
    vco.pitch = value;
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

  if (isVcoModule(fromModule)) {
    ensureVco(*engine, fromModule);
  }
  if (isVcoModule(toModule)) {
    ensureVco(*engine, toModule);
  }

  engine->connections.push_back({
    std::string(fromModule),
    std::string(fromJack),
    std::string(toModule),
    std::string(toJack)
  });
}

EMSCRIPTEN_KEEPALIVE void wasmod_disconnect(EngineState* engine, const char* /*cable_id*/) {
  if (!engine) {
    return;
  }
  if (!engine->connections.empty()) {
    engine->connections.pop_back();
  }
}

EMSCRIPTEN_KEEPALIVE int wasmod_get_connection_count(EngineState* engine) {
  if (!engine) {
    return -1;
  }
  return static_cast<int>(engine->connections.size());
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
    float mix = 0.0f;
    int active_vco_count = 0;

    for (const ConnectionState& connection : engine->connections) {
      const bool toSpeaker = isSpeakerInput(connection.to_module, connection.to_jack);
      const bool fromSpeaker = isSpeakerInput(connection.from_module, connection.from_jack);

      if (toSpeaker && isVcoModule(connection.from_module) && connection.from_jack == "audio_out") {
        mix += nextSine(*engine, ensureVco(*engine, connection.from_module));
        active_vco_count += 1;
      } else if (fromSpeaker && isVcoModule(connection.to_module) && connection.to_jack == "audio_out") {
        mix += nextSine(*engine, ensureVco(*engine, connection.to_module));
        active_vco_count += 1;
      }
    }

    if (active_vco_count > 1) {
      mix /= static_cast<float>(active_vco_count);
    }

    output[frame] = mix * 0.18f;
  }
}

}
