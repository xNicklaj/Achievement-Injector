#include "ObjectStateCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ObjectStateCondition::ObjectStateCondition(void) : Condition(ConditionType::ObjectState){};
void ObjectStateCondition::OnDataLoaded(void) {
    this->CheckCondition();
};
void ObjectStateCondition::EnableListener(void) {
    RegisterPostLoadFunction(this);
    RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
};
void ObjectStateCondition::SetConditionParameters(std::string formID_a, bool state_a) {
    this->formID = formID_a;
    this->state = state_a;
};
bool ObjectStateCondition::CheckCondition() {
    if (this->isMet)
        return true;
    RE::TESObjectREFR* target = static_cast<RE::TESObjectREFR*>(GetForm(this->formID, this->plugin));
    if (!target)
        return false;
    logger::debug("Object {} is {}.", this->formID, !target->IsDisabled() ? "ENABLED" : "DISABLED");
    if (target->IsDisabled() == !this->state) {
        this->UnlockNotify();
        RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
        return true;
    }
    return false;
};

RE::BSEventNotifyControl ObjectStateCondition::ProcessEvent(const RE::PositionPlayerEvent*, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
    if (!this->isMet)
        CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}

ObjectStateConditionFactory::ObjectStateConditionFactory()
    : ConditionFactory(){};
Condition* ObjectStateConditionFactory::createCondition() {
    return new ObjectStateCondition();
};