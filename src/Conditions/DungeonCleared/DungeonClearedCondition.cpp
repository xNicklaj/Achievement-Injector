#include "DungeonClearedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

extern void RegisterPostLoadFunction(Condition* condition);

DungeonClearedCondition::DungeonClearedCondition() : Condition() {}
void DungeonClearedCondition::OnDataLoaded(void) {
    this->cachedLoc = GetFormOfType<RE::BGSLocation>(this->formid, this->plugin);
    if (this->cachedLoc) KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Subscribe(StatKey("Dungeons Cleared"), this);
    CheckCondition();
}
void DungeonClearedCondition::EnableListener() {
    RegisterPostLoadFunction(this);
}
void DungeonClearedCondition::SetConditionParameters(std::string formid_a) {
    this->formid = formid_a;
}
bool DungeonClearedCondition::CheckCondition() {
    RE::BGSLocation* target = this->cachedLoc;
    if (!target) return false;
    if (target->IsCleared()) {
        logger::info("Player met condition location {} cleared.", this->formid);
        UnlockNotify();
        StopListening();
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
void DungeonClearedCondition::StopListening(void) {
    KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Unsubscribe(this);
}
