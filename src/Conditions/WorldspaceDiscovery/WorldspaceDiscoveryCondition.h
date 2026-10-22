#include "../Condition.h"
#include "../LocationDiscovery/LocationDiscoveryCondition.h"

#ifndef WORLDSPACEDISCOVERYCONDITION_H
#define WORLDSPACEDISCOVERYCONDITION_H

class WorldspaceDiscoveryCondition : public Condition, public RE::BSTEventSink<RE::LocationDiscovery::Event> {
public:
	WorldspaceDiscoveryCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void StopListening(void) override;
	void SetConditionParameters(std::string worldspaceID_a, int requiredCount_a);
	bool CheckCondition(void) override;

	RE::BSEventNotifyControl ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) override;

	std::string worldspaceID;
	int requiredCount;
};

#endif
