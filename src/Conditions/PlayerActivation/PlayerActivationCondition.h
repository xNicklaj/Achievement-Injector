#include "../Condition.h"

class PlayerActivationCondition : public Condition, public RE::BSTEventSink<RE::TESActivateEvent> {
public:
	PlayerActivationCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) override;
};

class PlayerActivationConditionFactory : public ConditionFactory {
public:
	PlayerActivationConditionFactory();
	Condition* createCondition() override;
};