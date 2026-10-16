#ifndef CUSTOM_SKILL_LEVEL_CONDITION_H
#define CUSTOM_SKILL_LEVEL_CONDITION_H

#include "../GlobalVariableState/GlobalVariableStateCondition.h"

// Minimal copy of Custom Skills Framework public API (include/CustomSkills/*.h, MIT, Copyright (c) Parapets)
namespace CustomSkills {
    constexpr std::uint32_t kCustomSkillsInterface = 0;  // SKSE message type, sender "CustomSkills"
    struct SkillIncreaseEvent {
        static constexpr std::uint32_t ID = 0;  // dispatcher id
        const char* skillID;
    };
    struct Interface {
        std::uint32_t interfaceVersion;
        void* ShowStatsMenu;
        void* AdvanceSkill;
        void* IncrementSkill;
        void* (*GetEventDispatcher)(std::uint32_t a_dispatcherID);
    };
}

// Registered for sender "CustomSkills" in plugin.cpp: grabs CSF skill increase dispatcher
void OnCustomSkillsMessage(SKSE::MessagingInterface::Message* a_msg);

// Custom Skills Framework keeps each skill's level in a global named by its JSON config, so this
// resolves that global and reuses GlobalVariableState's check. Without CSF it just never unlocks.
class CustomSkillLevelCondition : public GlobalVariableStateCondition, public RE::BSTEventSink<RE::MenuOpenCloseEvent>, public RE::BSTEventSink<CustomSkills::SkillIncreaseEvent> {
public:
    void EnableListener() override;
    void OnDataLoaded() override;
    void SetConditionParameters(std::string skill, float level) override;

private:
    RE::BSEventNotifyControl ProcessEvent(const CustomSkills::SkillIncreaseEvent* a_event, RE::BSTEventSource<CustomSkills::SkillIncreaseEvent>*) override;
    RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
    std::string skill;
};

#endif // CUSTOM_SKILL_LEVEL_CONDITION_H
