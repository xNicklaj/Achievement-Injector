#include "../Condition.h"

class ActorDeathCondition : public Condition, public RE::BSTEventSink<RE::TESDeathEvent> {
public:
	ActorDeathCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formID) override;
	bool CheckCondition(RE::FormID);

	std::string formID;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESDeathEvent * a_event, RE::BSTEventSource<RE::TESDeathEvent>*) override;
};

class ActorDeathConditionFactory : public ConditionFactory {
public:
	ActorDeathConditionFactory();
	Condition* createCondition() override;
};