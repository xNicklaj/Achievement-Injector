#include "../Condition.h"

class PlayerActivationCondition : public Condition, public RE::BSTEventSink<RE::TESActivateEvent> {
public:
	PlayerActivationCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void StopListening(void) override;
	void SetConditionParameters(std::string formid) override;
	void SetConditionParameters(std::string formid, int quantity) override;
	bool CheckCondition() override;
	int Serialize() override;
	bool Deserialize(int value) override;

	std::string formid;
	RE::FormID cachedFormID = 0;
	int quantity = 1;
	int currQuantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) override;
};