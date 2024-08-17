#include "DungeonClearedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

extern void RegisterPostLoadFunction(Condition* condition);

DungeonClearedCondition::DungeonClearedCondition() : Condition(ConditionType::LocationCleared) {}
void DungeonClearedCondition::OnDataLoaded(void) {
    CheckCondition();
}
void DungeonClearedCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
    logger::debug("Registered AAAA");
}
void DungeonClearedCondition::SetConditionParameters(std::string formid) {
    this->formid = formid;
}
bool DungeonClearedCondition::CheckCondition() {
    RE::BGSLocation* target = static_cast<RE::BGSLocation*>(GetForm(this->formid, this->plugin));
    if (!target) return false;
    if (target->IsCleared()) {
        logger::info("Player met condition location {} cleared.", this->formid);
        UnlockNotify();
        RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
        return true;
    }
    return false;
}
RE::BSEventNotifyControl DungeonClearedCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
    if (a_event->stat == "Dungeons Cleared") {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}

DungeonClearedConditionFactory::DungeonClearedConditionFactory() : ConditionFactory() {};
Condition* DungeonClearedConditionFactory::createCondition() {
    return new DungeonClearedCondition();
};