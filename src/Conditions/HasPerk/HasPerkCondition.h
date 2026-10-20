#ifndef HASPERK_CONDITION_H
#define HASPERK_CONDITION_H

#include "../Condition.h"
#include "../../CommonFunctions.h"

class HasPerkCondition : public Condition, public RE::BSTEventSink<RE::MenuOpenCloseEvent> {
public:
	HasPerkCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formID) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string formIDStr;
	RE::BGSPerk* perk = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
};

#endif // HASPERK_CONDITION_H
