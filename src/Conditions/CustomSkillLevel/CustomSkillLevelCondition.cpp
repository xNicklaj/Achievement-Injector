#include "CustomSkillLevelCondition.h"
#include "../../CommonFunctions.h"

#include <filesystem>

namespace {
    RE::BSTEventSource<CustomSkills::SkillIncreaseEvent>* csfDispatcher = nullptr;

    // Returns the "plugin|formID" string of the skill's level global, or "" if CSF or the skill is absent
    std::string FindLevelGlobal(const std::string& skillId) {
        const std::filesystem::path dir = "Data/SKSE/Plugins/CustomSkills";
        std::error_code ec;
        if (!std::filesystem::is_directory(dir, ec)) return "";
        // Configs can sit in subfolders and be either a skill itself or a list of skills / "$ref" strings
        for (const auto& entry : std::filesystem::recursive_directory_iterator(dir, ec)) {
            if (entry.path().extension() != ".json") continue;
            try {
                std::ifstream file(entry.path());
                const json config = json::parse(file, nullptr, true, true);
                // A single-skill config may omit "id" and takes the file name instead
                const auto matches = [&](const json& s, bool single) {
                    return s.is_object() && s.value("id", single ? entry.path().stem().string() : "") == skillId;
                };
                if (config.contains("skills")) {
                    const auto& skills = config["skills"];
                    for (const auto& s : skills)
                        if (matches(s, skills.size() == 1)) return s.value("level", "");
                } else if (matches(config, true)) {
                    return config.value("level", "");
                }
            } catch (const std::exception& e) {
                logger::warn("CustomSkillLevel: skipping {}: {}", entry.path().string(), e.what());
            }
        }
        return "";
    }
}

void CustomSkillLevelCondition::SetConditionParameters(std::string skill_a, float level_a) {
    this->skill = skill_a;
    this->value = level_a;
}

void CustomSkillLevelCondition::OnDataLoaded() {
    const std::string ref = FindLevelGlobal(this->skill);
    const auto sep = ref.find('|');
    if (sep == std::string::npos) {
        logger::warn("CustomSkillLevel: no level global for skill \"{}\" (Custom Skills Framework missing?), condition inactive.", this->skill);
        return;
    }
    this->cachedGlobal = GetFormOfType<RE::TESGlobal>(ref.substr(sep + 1), ref.substr(0, sep));
    if (!this->cachedGlobal) logger::warn("CustomSkillLevel: global {} not found, condition inactive.", ref);
    CheckCondition();
}

void OnCustomSkillsMessage(SKSE::MessagingInterface::Message* a_msg) {
    if (!a_msg || a_msg->type != CustomSkills::kCustomSkillsInterface || !a_msg->data) return;
    const auto intfc = static_cast<CustomSkills::Interface*>(a_msg->data);
    csfDispatcher = static_cast<RE::BSTEventSource<CustomSkills::SkillIncreaseEvent>*>(
        intfc->GetEventDispatcher(CustomSkills::SkillIncreaseEvent::ID));
    logger::info("CustomSkills interface v{} received, dispatcher {}", intfc->interfaceVersion, csfDispatcher ? "ok" : "missing");
}

RE::BSEventNotifyControl CustomSkillLevelCondition::ProcessEvent(const CustomSkills::SkillIncreaseEvent* a_event, RE::BSTEventSource<CustomSkills::SkillIncreaseEvent>*) {
    if (this->isMet) {
        if (csfDispatcher) csfDispatcher->RemoveEventSink(this);
    } else if (a_event && a_event->skillID && _stricmp(a_event->skillID, this->skill.c_str()) == 0) {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}

void CustomSkillLevelCondition::EnableListener() {
    GlobalVariableStateCondition::EnableListener();
    if (csfDispatcher) csfDispatcher->AddEventSink(this);
    // Fallback if the CSF event is missing or fires before the global is updated: also re-check when a menu closes
    RE::UI::GetSingleton()->AddEventSink<RE::MenuOpenCloseEvent>(this);
}

RE::BSEventNotifyControl CustomSkillLevelCondition::ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
    if (this->isMet) {
        RE::UI::GetSingleton()->RemoveEventSink<RE::MenuOpenCloseEvent>(this);
    } else if (a_event && !a_event->opening) {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}
