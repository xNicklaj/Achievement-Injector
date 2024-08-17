#include "DragonSoulsAbsorbedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

DragonSoulAbsorbedCondition::DragonSoulAbsorbedCondition() : Condition(ConditionType::DragonSoulAbsorbed) {}
void DragonSoulAbsorbedCondition::OnDataLoaded(void) {
    CheckCondition();
}
void DragonSoulAbsorbedCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::DragonSoulsGained::GetEventSource()->AddEventSink(this);
}
void DragonSoulAbsorbedCondition::SetConditionParameters(int quantity) {
    this->quantity = quantity;
}
bool DragonSoulAbsorbedCondition::CheckCondition() {
    RE::TESGlobal* absorbed = RE::TESDataHandler::GetSingleton()->LookupForm<RE::TESGlobal>(0x1C0F2, "Skyrim.esm");
    short totalAbsorbed = absorbed->value;
    if (totalAbsorbed >= quantity) {
        logger::info("Player met condition absorbed souls {}", this->quantity);
        this->UnlockNotify();
        RE::DragonSoulsGained::GetEventSource()->RemoveEventSink(this);
        return true;
    }
    return false;
}
RE::BSEventNotifyControl DragonSoulAbsorbedCondition::ProcessEvent(const RE::DragonSoulsGained::Event* a_event, RE::BSTEventSource<RE::DragonSoulsGained::Event>*) {
    // TODO tutto ma triggera
    CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}

DragonSoulAbsorbedConditionFactory::DragonSoulAbsorbedConditionFactory() : ConditionFactory() {};
Condition* DragonSoulAbsorbedConditionFactory::createCondition() {
    return new DragonSoulAbsorbedCondition();
};
