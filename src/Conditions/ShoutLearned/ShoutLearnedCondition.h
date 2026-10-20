#include "../Condition.h"

class ShoutLearnedCondition : public Condition, public RE::BSTEventSink<RE::TESTrackedStatsEvent>
{
public:
	ShoutLearnedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill, int wordNumber) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string FormID;
	int wordNumber = 1;
	RE::TESShout* cachedShout = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) override;
};