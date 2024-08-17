#include "../Condition.h"

class ShoutLearnedCondition : public Condition, public RE::BSTEventSink<RE::TESTrackedStatsEvent>
{
public:
	ShoutLearnedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill, int wordNumber) override;
	bool CheckCondition() override;

	std::string FormID;
	int wordNumber = 1;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) override;
};

class ShoutLearnedConditionFactory : public ConditionFactory
{
public:
	ShoutLearnedConditionFactory();
	Condition* createCondition() override;
};