#include "../Condition.h"

class SpellLearnedCondition : public Condition, public RE::BSTEventSink<RE::SpellsLearned::Event>
{
public:
	SpellLearnedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill) override;
	bool CheckCondition() override;

	std::string FormID;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::SpellsLearned::Event* a_event, RE::BSTEventSource<RE::SpellsLearned::Event>*) override;
};

class SpellLearnedConditionFactory : public ConditionFactory
{
public:
	SpellLearnedConditionFactory();
	Condition* createCondition() override;
};