#include "../Condition.h"

class PlayerLevelCondition : public Condition, public RE::BSTEventSink<RE::LevelIncrease::Event> {
public:
	PlayerLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(int level) override;
	bool CheckCondition() override;

	int level = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) override;
};

class PlayerLevelConditionFactory : public ConditionFactory {
public:
	PlayerLevelConditionFactory();
	Condition* createCondition() override;
};