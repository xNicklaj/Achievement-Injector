#include "DragonSoulsAbsorbedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

DragonSoulAbsorbedCondition::DragonSoulAbsorbedCondition() : Condition() {}
void DragonSoulAbsorbedCondition::OnDataLoaded(void) {
    CheckCondition();
}
void DragonSoulAbsorbedCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::DragonSoulsGained::GetEventSource()->AddEventSink(this);
}
void DragonSoulAbsorbedCondition::SetConditionParameters(int quantity_a) {
    this->quantity = quantity_a;
}
bool DragonSoulAbsorbedCondition::CheckCondition() {
    RE::TESGlobal* absorbed = RE::TESDataHandler::GetSingleton()->LookupForm<RE::TESGlobal>(0x1C0F2, "Skyrim.esm");
    if (!absorbed) {
        logger::warn("Dragon souls global not found.");
        return false;
    }
    float totalAbsorbed = absorbed->value;
    if (totalAbsorbed >= quantity) {
        logger::info("Player met condition absorbed souls {}", this->quantity);
        this->UnlockNotify();
        StopListening();
        return true;
    }
    return false;
}
RE::BSEventNotifyControl DragonSoulAbsorbedCondition::ProcessEvent(const RE::DragonSoulsGained::Event*, RE::BSTEventSource<RE::DragonSoulsGained::Event>*) {
    // TODO tutto ma triggera
    CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
void DragonSoulAbsorbedCondition::StopListening(void) {
    RE::DragonSoulsGained::GetEventSource()->RemoveEventSink(this);
}
