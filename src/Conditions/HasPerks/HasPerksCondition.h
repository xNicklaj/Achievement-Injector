#ifndef HASPERKS_CONDITION_H
#define HASPERKS_CONDITION_H

#include "../Condition.h"
#include "../../CommonFunctions.h"

class HasPerksCondition : public Condition, public RE::BSTEventSink<RE::MenuOpenCloseEvent> {
public:
	HasPerksCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::vector<std::string> formIDs, int threshold) override;
	bool CheckCondition() override;

	std::vector<std::string> formIDs;
	std::vector<RE::BGSPerk*> perks;
	int threshold = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
};

#endif // HASPERKS_CONDITION_H
