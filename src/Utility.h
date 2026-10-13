#ifndef UTILITY_H
#define UTILITY_H

#include <SimpleIni.h>
#include <spdlog/sinks/basic_file_sink.h>

#include <fstream>
#include <nlohmann/json.hpp>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <mutex>
#include <condition_variable>

namespace logger = SKSE::log;

std::string GetKeyNameFromScanCode(int scanCode);
void DisplayEntryWithWait(const std::tuple<std::string, std::string, std::string> achievement);
bool CheckIfModIsLoaded(RE::BSFixedString a_modname);

#endif  // UTILITY_H
