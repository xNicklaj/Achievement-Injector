#include "../Condition.h"

class DragonSoulAbsorbedCondition : public Condition, public RE::BSTEventSink<RE::DragonSoulsGained::Event> {
public:
	DragonSoulAbsorbedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(int quantity) override;
	bool CheckCondition() override;

	int quantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::DragonSoulsGained::Event* a_event, RE::BSTEventSource<RE::DragonSoulsGained::Event>*) override;
};

class DragonSoulAbsorbedConditionFactory : public ConditionFactory {
public:
	DragonSoulAbsorbedConditionFactory();
	Condition* createCondition() override;
};