#include "../Condition.h"

class PlayerActivationCondition : public Condition, public RE::BSTEventSink<RE::TESActivateEvent> {
public:
	PlayerActivationCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) override;
};