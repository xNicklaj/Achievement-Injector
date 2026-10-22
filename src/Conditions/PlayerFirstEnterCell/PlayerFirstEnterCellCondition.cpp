#include "PlayerFirstEnterCellCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerFirstEnterCellCondition::PlayerFirstEnterCellCondition() : Condition() {}
void PlayerFirstEnterCellCondition::SetConditionParameters(std::string cellID_a) {
    this->cellID = cellID_a;
}
void PlayerFirstEnterCellCondition::OnDataLoaded(void) {
    this->cachedFormID = GetFormID(this->cellID, this->plugin);
    if (this->cachedFormID) KeyedSink<RE::BGSActorCellEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
}
void PlayerFirstEnterCellCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
}
RE::BSEventNotifyControl PlayerFirstEnterCellCondition::ProcessEvent(const RE::BGSActorCellEvent* event, RE::BSTEventSource<RE::BGSActorCellEvent>*) {
    if (event->cellID == this->cachedFormID) {
        logger::info("Player met condition entered cell {}.", this->cellID);
        this->UnlockNotify();
        StopListening();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerFirstEnterCellCondition::CheckCondition() {

    return false;
}
void PlayerFirstEnterCellCondition::StopListening(void) {
    KeyedSink<RE::BGSActorCellEvent>::GetSingleton()->Unsubscribe(this);
}
