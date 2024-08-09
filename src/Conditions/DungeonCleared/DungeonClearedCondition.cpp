#include "DungeonClearedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

extern void RegisterPostLoadFunction(Condition* condition);

DungeonClearedCondition::DungeonClearedCondition() : Condition(ConditionType::LocationDiscovery) {}
void DungeonClearedCondition::OnDataLoaded(void) {

}
void DungeonClearedCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::LocationDiscovery::GetEventSource()->AddEventSink(this);
}
void DungeonClearedCondition::SetConditionParameters(std::string locationName, int) {

}
bool DungeonClearedCondition::CheckCondition() {
    
    return false;
}
RE::BSEventNotifyControl DungeonClearedCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
    if (a_event->stat == "Dungeons Cleared") {
        a_event->value;
    }
    return RE::BSEventNotifyControl::kContinue;
}

DungeonClearedConditionFactory::DungeonClearedConditionFactory() : ConditionFactory() {};
Condition* DungeonClearedConditionFactory::createCondition() {
    return new DungeonClearedCondition();
};