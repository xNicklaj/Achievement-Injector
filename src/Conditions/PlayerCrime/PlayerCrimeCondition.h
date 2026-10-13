#include "../Condition.h"
#include <vector>

#ifndef PLAYERCRIMECONDITION_H
#define PLAYERCRIMECONDITION_H

class PlayerCrimeCondition : public Condition, public RE::BSTEventSink<RE::TESTrackedStatsEvent> {
public:
	PlayerCrimeCondition(void);
	void EnableListener(void) override;
	void OnDataLoaded(void) override;
	void SetConditionParameters(std::vector<std::string> factionIDs_a, int bountyThreshold_a) override;
	bool CheckCondition(void) override;

	RE::BSEventNotifyControl ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) override;

	std::vector<std::string> factionIDs;
	int bountyThreshold;
	std::vector<RE::TESFaction*> cachedFactions;
};

#endif