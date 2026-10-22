#ifndef CONDITIONSMET_CONDITION_H
#define CONDITIONSMET_CONDITION_H

#include "../Condition.h"

// Met when "quantity" of its sub-conditions are met. JSON: { "type": "ConditionsMet", "quantity": 3, "conditions": [ { ... }, ... ] }
// Sub-conditions are ordinary conditions; "live"/"negate" are not supported on them. Once met, the sub-conditions stop listening.
// Saved progress is positional: reordering or inserting sub-conditions after players have progress shifts it onto the wrong ones.
class ConditionsMetCondition : public Condition {
public:
	ConditionsMetCondition();
	// Throws on a quantity that can't be reached or isn't positive; the factory logs it and skips the condition
	void SetParameters(int quantity, json& conditions, const std::string& plugin, const std::string& groupName, const std::string& achievementName);
	void EnableListener(void) override;
	void StopListening(void) override;
	void SerializeChildren(std::vector<int>& out) override;
	size_t LoadChildren(const std::vector<int>& state, size_t offset) override;

private:
	void OnChildMet();

	std::vector<Condition*> children;
	// Children report here, not to the achievement: only this condition's own met state reaches it
	eventpp::EventDispatcher<std::string, void()> childEvents;
	int quantity = 1;
	bool done = false;
};

#endif // CONDITIONSMET_CONDITION_H
