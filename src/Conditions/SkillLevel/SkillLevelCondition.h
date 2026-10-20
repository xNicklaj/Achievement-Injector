#include "../Condition.h"

class PlayerSkillLevelCondition : public Condition, public RE::BSTEventSink<RE::SkillIncrease::Event> {
public:
	PlayerSkillLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill, int level) override;
	void SetConditionParameters(std::string skill, std::string op, int level) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string skill;
	std::string OP = ">=";
	int level = 0;
	RE::ActorValue cachedSkill = RE::ActorValue::kNone;

private:
	RE::BSEventNotifyControl ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>*) override;
};