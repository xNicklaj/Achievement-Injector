#include "ItemInInventoryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ItemInInventoryCondition::ItemInInventoryCondition() : Condition() {}
void ItemInInventoryCondition::OnDataLoaded(void) {
	this->cachedForm = GetForm(this->formid, this->plugin);
    if (this->cachedForm) KeyedSink<RE::TESContainerChangedEvent>::GetSingleton()->Subscribe(this->cachedForm->formID, this);
    CheckCondition();
}
void ItemInInventoryCondition::EnableListener() {
    RegisterPostLoadFunction(this);
}
void ItemInInventoryCondition::SetConditionParameters(std::string formid_a, int quantity_a) {
    this->formid = formid_a;
    this->quantity = quantity_a;
}
RE::BSEventNotifyControl ItemInInventoryCondition::ProcessEvent(const RE::TESContainerChangedEvent* a_event, RE::BSTEventSource<RE::TESContainerChangedEvent>*) {
    if (a_event->newContainer == RE::PlayerCharacter::GetSingleton()->GetFormID()) {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool ItemInInventoryCondition::Evaluate() {
    // Live conditions skip OnDataLoaded, so resolve lazily
    if (!this->cachedForm) this->cachedForm = GetForm(this->formid, this->plugin);
    auto player = RE::PlayerCharacter::GetSingleton();
    if (!this->cachedForm || !player) return false;
    int quantity_l = 0;

    const auto inventory = player->GetInventory();
    for (auto& [item, data] : inventory) {
        // For fucking reasons data.first is the amount. Ok
        if (item != NULL && item->GetFormID() == this->cachedForm->formID) {
            quantity_l += data.first;
        }
    }
    return quantity_l >= this->quantity;
}
bool ItemInInventoryCondition::CheckCondition() {
    if (Evaluate()) {
        logger::info("Player met condition item {} quantity {}", this->formid, this->quantity);
        this->UnlockNotify();
        KeyedSink<RE::TESContainerChangedEvent>::GetSingleton()->Unsubscribe(this);
        return true;
    }
    return false;
}