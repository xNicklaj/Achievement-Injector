#ifndef FACTIONRANK_CONDITION_H
#define FACTIONRANK_CONDITION_H

#include "../Condition.h"
#include "../../CommonFunctions.h"

// Met when the player is in a faction at the given rank or higher. JSON: { "type": "FactionRank", "formID": "<faction>", "rank": 0 }
// rank is optional and defaults to 0, which is plain membership (the game stores -1 for "not a member").
// Re-checked whenever a menu closes; faction changes raise no game event.
class FactionRankCondition : public Condition, public RE::BSTEventSink<RE::MenuOpenCloseEvent> {
public:
	FactionRankCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formID, int rank) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string formIDStr;
	int rank = 0;
	RE::TESFaction* faction = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
};

#endif // FACTIONRANK_CONDITION_H
