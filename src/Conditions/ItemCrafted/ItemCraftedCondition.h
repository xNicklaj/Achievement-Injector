#include "../Condition.h"

class ItemCraftedCondition : public Condition, public RE::BSTEventSink<RE::ItemCrafted::Event> {
public:
	ItemCraftedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string itemID) override;
	void SetConditionParameters(std::string itemID, int quantity) override;
	int Serialize() override;
	bool Deserialize(int value) override;
	bool CheckCondition(RE::FormID itemID);
	
	std::string itemID;
	RE::TESForm* cachedForm = nullptr;
	int quantity = 1;
	int currQuantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::ItemCrafted::Event* a_event, RE::BSTEventSource<RE::ItemCrafted::Event>*) override;
};
