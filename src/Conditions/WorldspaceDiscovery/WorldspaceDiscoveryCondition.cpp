#include "WorldspaceDiscoveryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);
extern RE::BSTArray<RE::ObjectRefHandle>* GetPlayerMapMarkers();

WorldspaceDiscoveryCondition::WorldspaceDiscoveryCondition() : Condition() {}

void WorldspaceDiscoveryCondition::OnDataLoaded(void) {
	CheckCondition();
}

void WorldspaceDiscoveryCondition::EnableListener() {
	RegisterPostLoadFunction(this);
	RE::LocationDiscovery::GetEventSource()->AddEventSink(this);
}

void WorldspaceDiscoveryCondition::SetConditionParameters(std::string worldspaceID_a, int requiredCount_a) {
	this->worldspaceID = worldspaceID_a;
	this->requiredCount = requiredCount_a;
}

bool WorldspaceDiscoveryCondition::CheckCondition() {
	auto* playerMapMarkers = GetPlayerMapMarkers();
	int count = 0;
	
	for (auto playerMapMarker : *playerMapMarkers) {
		const auto refr = playerMapMarker.get().get();
		if (refr && !refr->IsDisabled()) {
			const auto marker = refr->extraList.GetByType<RE::ExtraMapMarker>();
			if (marker && marker->mapData) {
				if (marker->mapData->flags.any(RE::MapMarkerData::Flag::kCanTravelTo)) {
					auto worldspace = refr->GetWorldspace();
					if (worldspace) {
						std::string wsEditorID = clib_util::editorID::get_editorID(worldspace);
						if (wsEditorID == this->worldspaceID) {
							count++;
						}
					}
				}
			}
		}
	}
	
	if (count >= this->requiredCount && this->requiredCount > 0) {
		logger::info("Player met condition: Discovered {} locations in {}.", this->requiredCount, this->worldspaceID);
		this->UnlockNotify();
		RE::LocationDiscovery::GetEventSource()->RemoveEventSink(this);
		return true;
	}
	
	return false;
}

RE::BSEventNotifyControl WorldspaceDiscoveryCondition::ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) {
	if (a_event->worldspaceID == this->worldspaceID) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}
