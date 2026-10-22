#include "../Condition.h"

class PlayerFirstEnterCellCondition : public Condition, public RE::BSTEventSink<RE::BGSActorCellEvent> {
public:
	PlayerFirstEnterCellCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void StopListening(void) override;
	void SetConditionParameters(std::string cellID) override;
	bool CheckCondition();
	std::string cellID;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::BGSActorCellEvent* a_event, RE::BSTEventSource<RE::BGSActorCellEvent>*) override;
};