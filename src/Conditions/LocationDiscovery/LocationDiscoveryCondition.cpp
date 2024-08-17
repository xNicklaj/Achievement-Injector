#include "LocationDiscoveryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

// --- Exergist Code ---
// Retrieve all map markers in the game
RE::BSTArray<RE::ObjectRefHandle>* GetPlayerMapMarkers() {
    RE::PlayerCharacter* player = RE::PlayerCharacter::GetSingleton();
    std::uint32_t offset = 0;
    if (REL::Module::IsAE())
        offset = 0x500;
    else if (REL::Module::IsSE())
        offset = 0x4F8;
    else
        offset = 0xAE8;
    return reinterpret_cast<RE::BSTArray<RE::ObjectRefHandle>*>((uintptr_t)player + offset);
}

// Check if targetLocation is known (map marker visible and enabled)
bool CheckKnownLocation(std::string targetLocation) {
    auto* playerMapMarkers = GetPlayerMapMarkers();
    for (auto playerMapMarker : *playerMapMarkers) {
        const auto refr = playerMapMarker.get().get();
        if (refr->IsDisabled() == false) { // Check if map marker is NOT disabled
            const auto marker = refr ? refr->extraList.GetByType<RE::ExtraMapMarker>() : nullptr;
            if (marker && marker->mapData) {
                if (marker->mapData->flags.any(RE::MapMarkerData::Flag::kCanTravelTo) == true) { // Check if map marker is visible
                    auto markerName = marker->mapData->locationName.GetFullName();
                    //logger::debug("Known Location Name = {}", markerName);
                    if (markerName == targetLocation) {
                        //std::string result = targetLocation + " location is known!";
                        //RE::DebugNotification(result.c_str());
                        return true;
                    }
                }
            }
        }
    }
    std::string result = targetLocation + " location is not known!";
    RE::DebugNotification(result.c_str());
    return false;
}
// --- Exergist Code ---

LocationDiscoveryCondition::LocationDiscoveryCondition() : Condition(ConditionType::LocationDiscovery) {}
void LocationDiscoveryCondition::OnDataLoaded(void) {
    if (CheckKnownLocation(this->locationName)) {
        logger::info("Player met condition found {} in {}.", this->locationName, this->worldspaceID);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        RE::LocationDiscovery::GetEventSource()->RemoveEventSink(this);
    };
}
void LocationDiscoveryCondition::Localize(std::string path) {
    if(this->locationName[0] == '$')
		this->locationName = LocalizationManager::GetSingleton()->GetLocalizedText(path, LocalizationManager::GetSingleton()->CurrentLocale(), this->locationName);
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