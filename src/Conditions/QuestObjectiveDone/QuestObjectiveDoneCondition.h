#include "../Condition.h"

class QuestObjectiveDoneCondition : public Condition, public RE::BSTEventSink<RE::TESQuestStageEvent>, public RE::BSTEventSink<RE::PositionPlayerEvent> {
public:
	QuestObjectiveDoneCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void StopListening(void) override;
	void SetConditionParameters(std::string formID, int objective) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string formID;
	int objective = 200;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESQuestStageEvent* a_event, RE::BSTEventSource<RE::TESQuestStageEvent>*) override;
	RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
	RE::TESQuest* quest = nullptr;
};