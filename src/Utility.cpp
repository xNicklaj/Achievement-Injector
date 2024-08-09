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

std::string lastEntry;
int menuHotkey;
int widgetX;
int widgetY;
float widgetScale;
int enableWidget;
int enableMenuOption;
std::string tutorialMessage;
std::string resistanceModConfig;
bool hintShown = false;
const std::string INI_FILE_PATH = "Data/Dragonborns Bestiary.ini";

void LoadDataFromINI() {
    CSimpleIniA ini;
    ini.SetUnicode();
    SI_Error rc = ini.LoadFile(INI_FILE_PATH.c_str());
    if (rc < 0) {
        logger::error("Failed to load INI file: {}", INI_FILE_PATH);
        return;
    }

    const char* keycodeStr = ini.GetValue("General", "iKeycode", "0");
    const char* widget_x = ini.GetValue("General", "iBestiaryWidget_X", "0");
    const char* widget_y = ini.GetValue("General", "iBestiaryWidget_Y", "0");
    const char* widget_scale = ini.GetValue("General", "iBestiaryWidgetScale", "0");
    const char* enable_widget = ini.GetValue("General", "iEnableWidget", "0");
    const char* enable_menu_option = ini.GetValue("General", "iEnableSystemMenuOption", "0");
    const char* tutorial_msg = ini.GetValue("General", "sTutorialMessage", "0");
    menuHotkey = std::stoi(keycodeStr);
    widgetX = std::stoi(widget_x);
    widgetY = std::stoi(widget_y);
    widgetScale = std::stof(widget_scale);
    enableWidget = std::stoi(enable_widget);
    enableMenuOption = std::stoi(enable_menu_option);
    tutorialMessage = tutorial_msg;
    logger::debug("Loaded keycode: {}", keycodeStr);
    logger::debug("Loaded widget x offset: {}", widget_x);
    logger::debug("Loaded widget y offset: {}", widget_y);
    logger::debug("Loaded widget scale: {}", widget_scale);
    logger::debug("Loaded widget enabled: {}", enable_widget);
    logger::debug("Loaded menu option enabled: {}", enable_menu_option);
    logger::debug("Loaded tutorial message localization: {}", tutorial_msg);
}


std::string GetKeyNameFromScanCode(int scanCode) {
    auto it = kKeyMap.find(scanCode);
    if (it != kKeyMap.end()) {
        return it->second;
    }
    return "Unknown";
}

void AddMenuOption() {
    const auto menu = RE::UI::GetSingleton()->GetMenu<RE::JournalMenu>(RE::JournalMenu::MENU_NAME).get();
    const auto view = menu ? menu->GetRuntimeData().systemTab.view : nullptr;
    RE::GFxValue page;
    if (!view || !view->GetVariable(&page, "_root.QuestJournalFader.Menu_mc.SystemFader.Page_mc")) {
        logger::warn("Couldn't find _root.QuestJournalFader.Menu_mc.SystemFader.Page_mc");
        return;
    }
    RE::GFxValue showModMenu;
    if (page.GetMember("_showModMenu", &showModMenu) && showModMenu.GetBool() == false) {
        std::array<RE::GFxValue, 1> args;
        args[0] = true;
        if (!page.Invoke("SetShowMod", nullptr, args.data(), args.size())) {
            logger::warn("Couldn't invoke SetShowMod");
            return;
        }
    }
    RE::GFxValue categoryList;
    if (page.GetMember("CategoryList", &categoryList)) {
        RE::GFxValue entryList;
        if (categoryList.GetMember("entryList", &entryList)) {
            std::uint32_t bestiaryIndex;

            std::uint32_t length = entryList.GetArraySize();
            for (std::uint32_t index = 0; index < length; ++index) {
                RE::GFxValue entry;
                if (entryList.GetElement(index, &entry)) {
                    RE::GFxValue textVal;
                    if (entry.GetMember("text", &textVal)) {
                        std::string text = textVal.GetString();
                        if (text == "$HELP") {
                            bestiaryIndex = index;
                            break;
                        }
                    }
                }
            }

            if (bestiaryIndex) {
                RE::GFxValue entryBestiary;
                view->CreateObject(&entryBestiary);
                entryBestiary.SetMember("text", SYSTEMMENU_ALIAS);
                entryList.SetElement(bestiaryIndex, entryBestiary);
                categoryList.Invoke("InvalidateData");

                return;
            }
        }
    }
    return;
}

bool CheckIfModIsLoaded(RE::BSFixedString a_modname) {
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    const RE::TESFile* modInfo = dataHandler->LookupModByName(a_modname.data());
    if (!modInfo || modInfo->compileIndex == 255) {
        return false;
    }
    return true;
}

float GetGlobalVariableValue(const std::string& editorID) {
    auto dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        logger::warn("TESDataHandler not found.");
        return 0.0f;
    }

    for (auto& global : dataHandler->GetFormArray<RE::TESGlobal>()) {
        if (global->GetFormEditorID() == editorID) {
            return global->value;
        }
    }

    logger::warn("Global variable with EditorID %s not found.", editorID.c_str());
    return 0.0f;
}

void DisplayEntryWithWait(const std::string& variant) {
    std::lock_guard<std::mutex> lock(entryMutex);
    entryQueue.push(variant);
}