#include "../Condition.h"

class QuestStageDoneCondition : public Condition, public RE::BSTEventSink<RE::TESQuestStageEvent> {
public:
	QuestStageDoneCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formID, std::string, int stage) override;
	bool CheckCondition() override;

	std::string formID;
	int stage = 200;
	std::string OP;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESQuestStageEvent* a_event, RE::BSTEventSource<RE::TESQuestStageEvent>*) override;
};

class QuestStageDoneConditionFactory : public ConditionFactory {
public:
	QuestStageDoneConditionFactory();
	Condition* createCondition() override;
};