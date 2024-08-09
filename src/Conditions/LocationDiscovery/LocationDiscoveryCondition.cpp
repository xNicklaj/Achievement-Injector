#include "LocationDiscoveryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

LocationDiscoveryCondition::LocationDiscoveryCondition() : Condition(ConditionType::LocationDiscovery) {}
void LocationDiscoveryCondition::OnDataLoaded(void) {

}
void LocationDiscoveryCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::LocationDiscovery::GetEventSource()->AddEventSink(this);
}
void LocationDiscoveryCondition::SetConditionParameters(std::string locationName, std::string worldspaceID) {
    this->locationName = locationName;
    this->worldspaceID = worldspaceID;
}
bool LocationDiscoveryCondition::CheckCondition(std::string locationName, std::string worldspaceID) {
    if (locationName == this->locationName && worldspaceID == this->worldspaceID) {
        logger::info("Player met condition found {} in {}.", this->locationName, this->worldspaceID);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        RE::LocationDiscovery::GetEventSource()->RemoveEventSink(this);
        return true;
    }
    return false;
}
RE::BSEventNotifyControl LocationDiscoveryCondition::ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) {
    CheckCondition(a_event->mapMarkerData->locationName.GetFullName(), a_event->worldspaceID);
    return RE::BSEventNotifyControl::kContinue;
}

LocationDiscoveryConditionFactory::LocationDiscoveryConditionFactory() : ConditionFactory() {};
Condition* LocationDiscoveryConditionFactory::createCondition() {
	return new LocationDiscoveryCondition();
};