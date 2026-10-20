#include "../Condition.h"

class ItemInInventoryCondition : public Condition, public RE::BSTEventSink<RE::TESContainerChangedEvent> {
public:
	ItemInInventoryCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid, int quantity) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string formid;
	int quantity = 1;
	RE::TESForm* cachedForm = nullptr;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESContainerChangedEvent* a_event, RE::BSTEventSource<RE::TESContainerChangedEvent>*) override;
};