#include "../Condition.h"

class ItemCraftedCondition : public Condition, public RE::BSTEventSink<RE::ItemCrafted::Event> {
public:
	ItemCraftedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string itemID) override;
	bool CheckCondition(RE::FormID itemID);
	
	std::string itemID;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::ItemCrafted::Event* a_event, RE::BSTEventSource<RE::ItemCrafted::Event>*) override;
};

class ItemCraftedConditionFactory : public ConditionFactory {
	public:
	ItemCraftedConditionFactory();
	Condition* createCondition() override;
};
