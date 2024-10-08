#pragma once

#include <spdlog/sinks/basic_file_sink.h>

namespace logger = SKSE::log;

void SetupLog(bool cleanFile = true);
std::optional<std::filesystem::path> GetLogDirectory();