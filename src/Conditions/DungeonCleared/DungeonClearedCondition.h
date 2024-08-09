#include "../Condition.h"

class DungeonClearedCondition : public Condition, public RE::BSTEventSink<RE::TESTrackedStatsEvent> {
public:
	DungeonClearedCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid, int quantity) override;
	bool CheckCondition() override;

	std::string formid;
	int quantity = 1;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) override;
};

class DungeonClearedConditionFactory : public ConditionFactory {
public:
	DungeonClearedConditionFactory();
	Condition* createCondition() override;
};