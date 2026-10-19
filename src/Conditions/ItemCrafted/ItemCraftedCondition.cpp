#include "ItemCraftedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ItemCraftedCondition::ItemCraftedCondition() : Condition() {}
void ItemCraftedCondition::OnDataLoaded(void) {
    this->cachedForm = GetForm(this->itemID, this->plugin);
}
void ItemCraftedCondition::EnableListener() {
	RegisterPostLoadFunction(this);
	RE::ItemCrafted::GetEventSource()->AddEventSink(this);
}
void ItemCraftedCondition::SetConditionParameters(std::string itemID__a) {
	this->itemID = itemID__a;
}
void ItemCraftedCondition::SetConditionParameters(std::string itemID_a, int quantity_a) {
	this->itemID = itemID_a;
	this->quantity = quantity_a;
}
int ItemCraftedCondition::Serialize() {
	return currQuantity;
}
bool ItemCraftedCondition::Deserialize(int value) {
	this->currQuantity = value;
	return this->currQuantity >= this->quantity;
}
bool ItemCraftedCondition::CheckCondition(RE::FormID itemID_a) {
	auto* target = this->cachedForm;
	if(target == NULL) return false;
	if (itemID_a == target->formID) {
		if (++this->currQuantity >= this->quantity) {
			logger::info("Player met condition crafted {}.", this->itemID);
			this->UnlockNotify();
			RE::ItemCrafted::GetEventSource()->RemoveEventSink(this);
			return true;
		}
		this->eventManager->dispatch("SerializationRequested");
	}
	return false;
}
RE::BSEventNotifyControl ItemCraftedCondition::ProcessEvent(const RE::ItemCrafted::Event* a_event, RE::BSTEventSource<RE::ItemCrafted::Event>*) {
	if (!a_event || !IsValidEventPtr(a_event->item, "ItemCrafted item")) return RE::BSEventNotifyControl::kContinue;
	CheckCondition(a_event->item->formID);
	return RE::BSEventNotifyControl::kContinue;
}