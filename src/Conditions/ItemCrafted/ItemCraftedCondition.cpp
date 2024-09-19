#include "ItemCraftedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ItemCraftedCondition::ItemCraftedCondition() : Condition(ConditionType::ItemCrafted) {}
void ItemCraftedCondition::OnDataLoaded(void) {

}
void ItemCraftedCondition::EnableListener() {
	RegisterPostLoadFunction(this);
	RE::ItemCrafted::GetEventSource()->AddEventSink(this);
}
void ItemCraftedCondition::SetConditionParameters(std::string itemID__a) {
	this->itemID = itemID__a;
}
bool ItemCraftedCondition::CheckCondition(RE::FormID itemID_a) {
	auto* target = GetForm(this->itemID, this->plugin);
	if(target == NULL) return false;
	if (itemID_a == target->formID) {
		logger::info("Player met condition crafted {}.", this->itemID);
		this->UnlockNotify();
		RE::ItemCrafted::GetEventSource()->RemoveEventSink(this);
		return true;
	}
	return false;
}
RE::BSEventNotifyControl ItemCraftedCondition::ProcessEvent(const RE::ItemCrafted::Event* a_event, RE::BSTEventSource<RE::ItemCrafted::Event>*) {
	CheckCondition(a_event->item->formID);
	return RE::BSEventNotifyControl::kContinue;
}

ItemCraftedConditionFactory::ItemCraftedConditionFactory() : ConditionFactory() {};
Condition* ItemCraftedConditionFactory::createCondition() {
	return new ItemCraftedCondition();
};