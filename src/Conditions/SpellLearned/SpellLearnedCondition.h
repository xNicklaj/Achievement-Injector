#include "../Condition.h"

class SpellLearnedCondition : public Condition, public RE::BSTEventSink<RE::SpellsLearned::Event>, public RE::BSTEventSink<RE::PositionPlayerEvent>
{
public:
	SpellLearnedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string FormID;
	RE::SpellItem* cachedSpell = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::SpellsLearned::Event* a_event, RE::BSTEventSource<RE::SpellsLearned::Event>*) override;
	RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
};