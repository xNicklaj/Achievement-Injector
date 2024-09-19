#include "PlayerFirstEnterCellCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerFirstEnterCellCondition::PlayerFirstEnterCellCondition() : Condition(ConditionType::FirstEnterCell) {}
void PlayerFirstEnterCellCondition::SetConditionParameters(std::string cellID_a) {
    this->cellID = cellID_a;
}
void PlayerFirstEnterCellCondition::OnDataLoaded(void) {
    // Check that quest hasn't been completed already
    CheckCondition();
}
void PlayerFirstEnterCellCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);

    // Bind sink for quest stage change event
    RE::PlayerCharacter::GetSingleton()->AsBGSActorCellEventSource()->AddEventSink(this);
}
RE::BSEventNotifyControl PlayerFirstEnterCellCondition::ProcessEvent(const RE::BGSActorCellEvent* event, RE::BSTEventSource<RE::BGSActorCellEvent>*) {
    logger::debug("Player entered cell {}", event->cellID);
    RE::TESForm* target = GetForm(this->cellID, this->plugin);
    if (target == NULL) return RE::BSEventNotifyControl::kContinue;
    if (event->cellID == target->formID) {
        logger::info("Player met condition entered cell {}.", this->cellID);
        this->UnlockNotify();
        RE::PlayerCharacter::GetSingleton()->AsBGSActorCellEventSource()->RemoveEventSink(this);
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerFirstEnterCellCondition::CheckCondition() {

    return false;
}

PlayerFirstEnterCellConditionFactory::PlayerFirstEnterCellConditionFactory() : ConditionFactory() {};
Condition* PlayerFirstEnterCellConditionFactory::createCondition() {
    return new PlayerFirstEnterCellCondition();
};