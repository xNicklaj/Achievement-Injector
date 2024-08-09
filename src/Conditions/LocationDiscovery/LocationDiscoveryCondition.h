#include "../Condition.h"

// CANNOT USE DUE TO IT NOT BEING MAPPED INSIDE RE

class LocationDiscoveryCondition : public Condition, public RE::BSTEventSink<RE::LocationDiscovery::Event> {
public:
	LocationDiscoveryCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string locationName, std::string worldspaceID) override;
	bool CheckCondition(std::string locationName, std::string worldspaceID);

	std::string locationName;
	std::string worldspaceID;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) override;
};

class LocationDiscoveryConditionFactory : public ConditionFactory {
public:
	LocationDiscoveryConditionFactory();
	Condition* createCondition() override;
};