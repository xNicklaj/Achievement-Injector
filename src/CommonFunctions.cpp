#include "log.h"
#include "CommonFunctions.h"

namespace logger = SKSE::log;

uint16_t CheckQuestStage(std::string FormID, std::string baseEsp) {
    // Get the TESDataHandler instance
    auto dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        logger::error("Failed to get TESDataHandler instance.");
        return -1;
    }

    // TODO dynamic esp
    // Get the quest form using the Editor Form ID
    const auto quest = RE::TESForm::LookupByEditorID<RE::TESQuest>(FormID);
    if (!quest) {
        logger::error("Failed to find quest with Editor Form ID: {}", FormID);
        return -1;
    }

    // Get the current stage of the quest
    auto currentStage = quest->GetCurrentStageID();
    return currentStage;
}

RE::TESForm* GetForm(std::string FormID, std::string baseEsp = "Skyrim.esm") {
	// Get the TESDataHandler instance
	auto dataHandler = RE::TESDataHandler::GetSingleton();
	if (!dataHandler) {
		logger::error("Failed to get TESDataHandler instance.");
		return nullptr;
	}

	// Get the quest form using the Editor Form ID
    RE::FormID actualFormID;
    std::istringstream converter(FormID);
    converter >> std::hex >> actualFormID;
    const auto form = RE::TESDataHandler::GetSingleton()->LookupForm(actualFormID, baseEsp);
	if (!form) {
		logger::error("Failed to find form with Form ID {} and IntFormID {} in plugin {}", FormID, actualFormID, baseEsp);
		return nullptr;
	}

	return form;
}

std::string FormIDToString(RE::FormID formID) {
    std::stringstream ss;
    ss << std::hex << std::uppercase << std::setw(8) << std::setfill('0') << formID;
    return ss.str();
}

RE::ActorValue StringToActorValue(std::string value) {
    if (value == "alchemy") return RE::ActorValue::kAlchemy;
    else if (value == "alteration") return RE::ActorValue::kAlteration;
    else if (value == "marksman") return RE::ActorValue::kArchery;
    else if (value == "block") return RE::ActorValue::kBlock;
    else if (value == "conjuration") return RE::ActorValue::kConjuration;
    else if (value == "destruction") return RE::ActorValue::kDestruction;
    else if (value == "enchanting") return RE::ActorValue::kEnchanting;
    else if (value == "heavyarmor") return RE::ActorValue::kHeavyArmor;
    else if (value == "illusion") return RE::ActorValue::kIllusion;
    else if (value == "lightarmor") return RE::ActorValue::kLightArmor;
    else if (value == "lockpicking") return RE::ActorValue::kLockpicking;
    else if (value == "onehanded") return RE::ActorValue::kOneHanded;
    else if (value == "pickpocket") return RE::ActorValue::kPickpocket;
    else if (value == "restoration") return RE::ActorValue::kRestoration;
    else if (value == "smithing") return RE::ActorValue::kSmithing;
    else if (value == "sneak") return RE::ActorValue::kSneak;
    else if (value == "speechcraft") return RE::ActorValue::kSpeech;
    else if (value == "twohanded") return RE::ActorValue::kTwoHanded;
    return RE::ActorValue::kNone;
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

void ReadJson(const std::string& filePath, json* jsonData) {
    // Open the JSON file
    std::ifstream file(filePath);
    if (!file.is_open()) {
        logger::error("Could not open the file {}!", filePath);
        return;
    }

    // Parse the JSON file
    file >> *jsonData;

    // Close the file
    file.close();
    return;
}