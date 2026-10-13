#include "LocationDiscoveryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

// --- Exergist Code ---
// Retrieve all map markers in the game
RE::BSTArray<RE::ObjectRefHandle>* GetPlayerMapMarkers() {
    RE::PlayerCharacter* player = RE::PlayerCharacter::GetSingleton();
    // CommonLib tracks the per-runtime layout (it shifted again in 1.7.99); a hardcoded offset crashed there
    if (REL::Module::IsVR()) return &player->GetVRPlayerRuntimeData()->currentMapMarkers;
    return &player->GetPlayerRuntimeData().currentMapMarkers;
}

// Check if targetLocation or formID is known (map marker visible and enabled)
bool CheckKnownLocation(std::string targetLocation, std::string targetFormID, std::string plugin) {
    auto* playerMapMarkers = GetPlayerMapMarkers();
    // Resolved once, not per marker
    RE::TESObjectREFR* targetRefr = targetFormID != "" ? GetFormOfType<RE::TESObjectREFR>(targetFormID, plugin) : nullptr;
    for (auto playerMapMarker : *playerMapMarkers) {
        const auto refr = playerMapMarker.get().get();
        if (refr && refr->IsDisabled() == false) { // Check if map marker is NOT disabled
            const auto marker = refr ? refr->extraList.GetByType<RE::ExtraMapMarker>() : nullptr;
            if (marker && marker->mapData) {
                if (marker->mapData->flags.any(RE::MapMarkerData::Flag::kCanTravelTo) == true) { // Check if map marker is visible
                    if (targetFormID != "") {
                        if (targetRefr && targetRefr->formID == refr->formID) {
                            return true;
                        }
                    } else {
                        auto markerName = marker->mapData->locationName.GetFullName();
                        if (markerName == targetLocation) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

RE::TESObjectREFR* FindMapMarkerByData(RE::MapMarkerData* a_data) {
    auto* playerMapMarkers = GetPlayerMapMarkers();
    for (auto playerMapMarker : *playerMapMarkers) {
        const auto refr = playerMapMarker.get().get();
        if (refr) {
            const auto marker = refr->extraList.GetByType<RE::ExtraMapMarker>();
            if (marker && marker->mapData == a_data) {
                return refr;
            }
        }
    }
    return nullptr;
}
// --- Exergist Code ---

LocationDiscoveryCondition::LocationDiscoveryCondition() : Condition() {}
void LocationDiscoveryCondition::OnDataLoaded(void) {
    try {
        auto* sink = KeyedSink<RE::LocationDiscovery::Event>::GetSingleton();
        if (this->formID != "") {
            this->cachedRef = GetFormOfType<RE::TESObjectREFR>(this->formID, this->plugin);
            if (this->cachedRef) sink->Subscribe(this->cachedRef->formID, this);
        } else {
            sink->Subscribe(StatKey(this->locationName), this);
        }
        if (CheckKnownLocation(this->locationName, this->formID, this->plugin)) {
            logger::info("Player met condition found {} in {}.", this->formID != "" ? this->formID : this->locationName, this->worldspaceID);
            this->UnlockNotify();
            KeyedSink<RE::LocationDiscovery::Event>::GetSingleton()->Unsubscribe(this);
        };
    } catch (const std::exception&) {
        logger::error("An error occurred in OnDataLoaded of LocationDiscoveryCondition, with parameters ({}, {})", this->locationName, this->worldspaceID);
    }
    
}
void LocationDiscoveryCondition::Localize(std::string path) {
    if(this->locationName != "" && this->locationName[0] == '$')
		this->locationName = LocalizationManager::GetSingleton()->GetLocalizedText(path, LocalizationManager::GetSingleton()->CurrentLocale(), this->locationName);
}
void LocationDiscoveryCondition::EnableListener() {
    RegisterPostLoadFunction(this);
}
void LocationDiscoveryCondition::SetConditionParameters(std::string locationName_a, std::string worldspaceID_a, std::string formID_a) {
    this->locationName = locationName_a;
    this->worldspaceID = worldspaceID_a;
    this->formID = formID_a;
}
bool LocationDiscoveryCondition::CheckCondition(std::string locationName_l, std::string worldspaceID_l) {
    // No worldspaceID in the JSON means any worldspace, as in the check at load
    if (locationName_l == this->locationName && (this->worldspaceID.empty() || worldspaceID_l == this->worldspaceID)) {
        logger::info("Player met condition found {} in {}.", this->locationName, this->worldspaceID);
        this->UnlockNotify();
        KeyedSink<RE::LocationDiscovery::Event>::GetSingleton()->Unsubscribe(this);
        return true;
    }
    return false;
}
RE::BSEventNotifyControl LocationDiscoveryCondition::ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) {
    if (this->formID != "") {
        RE::TESObjectREFR* refr = FindMapMarkerByData(a_event->mapMarkerData);
        if (refr) {
            RE::TESObjectREFR* targetRefr = this->cachedRef;
            if (targetRefr && targetRefr->formID == refr->formID) {
                logger::info("Player met condition found {} in {}.", this->formID, this->worldspaceID);
                this->UnlockNotify();
                KeyedSink<RE::LocationDiscovery::Event>::GetSingleton()->Unsubscribe(this);
                return RE::BSEventNotifyControl::kContinue;
            }
        }
    } else {
        CheckCondition(a_event->mapMarkerData->locationName.GetFullName(), a_event->worldspaceID);
    }
    return RE::BSEventNotifyControl::kContinue;
}