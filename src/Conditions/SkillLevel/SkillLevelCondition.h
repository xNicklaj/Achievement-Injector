#include "../Condition.h"

class PlayerSkillLevelCondition : public Condition, public RE::BSTEventSink<RE::SkillIncrease::Event> {
public:
	PlayerSkillLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill, int level) override;
	bool CheckCondition() override;

	std::string skill;
	int level = 0;

private:
	RE::BSEventNotifyControl ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>*) override;
};

class PlayerSkillLevelConditionFactory : public ConditionFactory {
public:
	PlayerSkillLevelConditionFactory();
	Condition* createCondition() override;
};