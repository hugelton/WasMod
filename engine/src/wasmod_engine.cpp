#include <algorithm>
#include <cmath>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
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
  int waveform = 2;
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
  std::vector<std::string> audible_vco_modules;
};

bool isVcoModule(std::string_view module_id) {
  return module_id.find("vco") != std::string_view::npos;
}

bool isSpeakerInput(std::string_view module_id, std::string_view jack_name) {
  return module_id.find("speaker") != std::string_view::npos && jack_name == "audio_in";
}

bool isJunctionModule(std::string_view module_id) {
  return module_id.find("junction") != std::string_view::npos;
}

bool isVcoAudioOutput(std::string_view module_id, std::string_view jack_name) {
  return isVcoModule(module_id) && jack_name == "audio_out";
}

std::string endpointKey(std::string_view module_id, std::string_view jack_name) {
  return std::string(module_id) + ":" + std::string(jack_name);
}

VcoState& ensureVco(EngineState& engine, std::string_view module_id) {
  return engine.vcos[std::string(module_id)];
}

float nextOscillator(EngineState& engine, VcoState& vco) {
  const float pitch = vco.pitch + vco.cv;
  const float tunedFrequency = std::max(20.0f, 261.625565f * std::pow(2.0f, pitch));
  const float increment = tunedFrequency / engine.sample_rate;
  vco.phase += increment;
  if (vco.phase >= 1.0f) {
    vco.phase -= 1.0f;
  }

  if (vco.waveform == 0) {
    return vco.phase * 2.0f - 1.0f;
  }
  if (vco.waveform == 1) {
    return vco.phase < 0.5f ? 1.0f : -1.0f;
  }
  return std::sin(vco.phase * kTwoPi);
}

void collectVcoOutputs(
  const EngineState& engine,
  std::string_view module_id,
  std::string_view jack_name,
  std::unordered_set<std::string>& visited,
  std::unordered_set<std::string>& outputs
) {
  const std::string key = endpointKey(module_id, jack_name);
  if (visited.find(key) != visited.end()) {
    return;
  }
  visited.insert(key);

  if (isVcoAudioOutput(module_id, jack_name)) {
    outputs.insert(std::string(module_id));
    return;
  }

  if (isJunctionModule(module_id)) {
    for (const ConnectionState& connection : engine.connections) {
      if (connection.from_module == module_id) {
        collectVcoOutputs(engine, connection.to_module, connection.to_jack, visited, outputs);
      }
      if (connection.to_module == module_id) {
        collectVcoOutputs(engine, connection.from_module, connection.from_jack, visited, outputs);
      }
    }
  }

  for (const ConnectionState& connection : engine.connections) {
    if (connection.from_module == module_id && connection.from_jack == jack_name) {
      collectVcoOutputs(engine, connection.to_module, connection.to_jack, visited, outputs);
    } else if (connection.to_module == module_id && connection.to_jack == jack_name) {
      collectVcoOutputs(engine, connection.from_module, connection.from_jack, visited, outputs);
    }
  }
}

std::unordered_set<std::string> audibleVcoOutputs(const EngineState& engine) {
  std::unordered_set<std::string> outputs;

  for (const ConnectionState& connection : engine.connections) {
    if (isSpeakerInput(connection.to_module, connection.to_jack)) {
      std::unordered_set<std::string> visited;
      collectVcoOutputs(engine, connection.from_module, connection.from_jack, visited, outputs);
    }
    if (isSpeakerInput(connection.from_module, connection.from_jack)) {
      std::unordered_set<std::string> visited;
      collectVcoOutputs(engine, connection.to_module, connection.to_jack, visited, outputs);
    }
  }

  return outputs;
}

void refreshAudibleVcoOutputs(EngineState& engine) {
  const std::unordered_set<std::string> outputs = audibleVcoOutputs(engine);
  engine.audible_vco_modules.assign(outputs.begin(), outputs.end());
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
  } else if (param == "Waveform") {
    vco.waveform = static_cast<int>(std::round(std::max(0.0f, std::min(2.0f, value))));
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
  refreshAudibleVcoOutputs(*engine);
}

EMSCRIPTEN_KEEPALIVE void wasmod_disconnect(EngineState* engine, const char* /*cable_id*/) {
  if (!engine) {
    return;
  }
  if (!engine->connections.empty()) {
    engine->connections.pop_back();
    refreshAudibleVcoOutputs(*engine);
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

  const std::vector<std::string>& active_vcos = engine->audible_vco_modules;
  const float active_vco_count = static_cast<float>(active_vcos.size());

  for (int frame = 0; frame < frame_count; ++frame) {
    float mix = 0.0f;

    for (const std::string& module_id : active_vcos) {
      mix += nextOscillator(*engine, ensureVco(*engine, module_id));
    }

    if (active_vco_count > 1.0f) {
      mix /= active_vco_count;
    }

    output[frame] = mix * 0.18f;
  }
}

}
