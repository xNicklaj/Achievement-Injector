#include "../Condition.h"

class ActorDeathCondition : public Condition, public RE::BSTEventSink<RE::TESDeathEvent> {
public:
	ActorDeathCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string) override;
	bool CheckCondition(RE::FormID);

	std::string formID;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESDeathEvent * a_event, RE::BSTEventSource<RE::TESDeathEvent>*) override;
};