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

const RE::GFxValue SYSTEMMENU_ALIAS = "$ACHIEVEMENT MENU";

extern int menuHotkey;
extern int widgetX;
extern int widgetY;
extern float widgetScale;
extern int enableWidget;
extern int enableMenuOption;
extern std::string tutorialMessage;
extern bool hintShown;
extern std::string resistanceModConfig;

struct VariantInfo {
    std::string creature;
    std::string category;
    std::string localizedName;
};


void LoadDataFromINI();
std::string GetKeyNameFromScanCode(int scanCode);
void AddMenuOption();
float GetGlobalVariableValue(const std::string& editorID);
void DisplayEntryWithWait(const std::tuple<std::string, std::string, std::string> achievement);
bool CheckIfModIsLoaded(RE::BSFixedString a_modname);

#endif  // UTILITY_H
