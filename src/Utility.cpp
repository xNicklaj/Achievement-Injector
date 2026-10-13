#include "Utility.h"

#include <spdlog/sinks/basic_file_sink.h>

#include <algorithm>
#include <filesystem>
#include <iostream>
#include <nlohmann/json.hpp>
#include "KeyMapping.h"
#include "Sync.h"


namespace fs = std::filesystem;
namespace logger = SKSE::log;

std::string GetKeyNameFromScanCode(int scanCode) {
    auto it = kKeyMap.find(scanCode);
    if (it != kKeyMap.end()) {
        return it->second;
    }
    return "Unknown";
}

bool CheckIfModIsLoaded(RE::BSFixedString a_modname) {
    // TODO remove logs
    //logger::info("Checking for {}...", a_modname.c_str());
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    const RE::TESFile* modInfo = dataHandler->LookupModByName(a_modname.data());
    if (!modInfo || modInfo->compileIndex == 255) {
		//logger::info("Mod {} is not loaded.", a_modname.c_str());
        return false;
    }
	//logger::info("Mod {} is loaded.", a_modname.c_str());
    return true;
}

void DisplayEntryWithWait(const std::tuple<std::string, std::string, std::string> achievement) {
    std::lock_guard<std::mutex> lock(entryMutex);
    entryQueue.push(achievement);
}