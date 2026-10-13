#ifndef LOCATIONDISCOVERYCONDITION_H
#define LOCATIONDISCOVERYCONDITION_H

#include "../Condition.h"
// CANNOT USE DUE TO IT NOT BEING MAPPED INSIDE RE

class LocationDiscoveryCondition : public Condition, public RE::BSTEventSink<RE::LocationDiscovery::Event> {
public:
	LocationDiscoveryCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string locationName_a, std::string worldspaceID_a, std::string formID_a);
	bool CheckCondition(std::string locationName_l, std::string worldspaceID_l);

	void Localize(std::string path) override;

	std::string locationName;
	std::string worldspaceID;
	std::string formID;
	RE::TESObjectREFR* cachedRef = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) override;
};

#endif