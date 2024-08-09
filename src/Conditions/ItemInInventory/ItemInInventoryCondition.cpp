#include "ItemInInventoryCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ItemInInventoryCondition::ItemInInventoryCondition() : Condition(ConditionType::ItemInInventory) {}
void ItemInInventoryCondition::OnDataLoaded(void) {
    CheckCondition();
}
void ItemInInventoryCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::ScriptEventSourceHolder* eventSourceHolder = RE::ScriptEventSourceHolder::GetSingleton();
    eventSourceHolder->AddEventSink(this);
}
void ItemInInventoryCondition::SetConditionParameters(std::string formid, int quantity) {
    this->formid = formid;
    this->quantity = quantity;
}
RE::BSEventNotifyControl ItemInInventoryCondition::ProcessEvent(const RE::TESContainerChangedEvent* a_event, RE::BSTEventSource<RE::TESContainerChangedEvent>*) {
    if (a_event->newContainer == RE::PlayerCharacter::GetSingleton()->GetFormID()) {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool ItemInInventoryCondition::CheckCondition() {
    RE::PlayerCharacter* player = RE::PlayerCharacter::GetSingleton();
    int quantity = 0;

    const auto inventory = RE::PlayerCharacter::GetSingleton()->GetInventory();
    RE::TESForm* target;
    for (auto& [item, data] : inventory) {
        // For fucking reasons data.first is the amount. Ok
        target = GetForm(this->formid, this->plugin);
        if (item != NULL && target != NULL && item->GetFormID() == target->formID) {
            quantity += data.first;
        }
    }
    if (quantity >= this->quantity) {
        logger::info("Player met condition item {} quantity {}", this->formid, this->quantity);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
        return true;
    }
    return false;
}

ItemInInventoryConditionFactory::ItemInInventoryConditionFactory() : ConditionFactory() {};
Condition* ItemInInventoryConditionFactory::createCondition() {
    return new ItemInInventoryCondition();
};