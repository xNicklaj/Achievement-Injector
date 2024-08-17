#include "SpellLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

SpellLearnedCondition::SpellLearnedCondition() : Condition(ConditionType::SpellLearned) {}
void SpellLearnedCondition::OnDataLoaded(void) {
    CheckCondition();
}
void SpellLearnedCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::SpellsLearned::GetEventSource()->AddEventSink(this);
}
void SpellLearnedCondition::SetConditionParameters(std::string formID) {
    this->FormID = formID;
}
RE::BSEventNotifyControl SpellLearnedCondition::ProcessEvent(const RE::SpellsLearned::Event* a_event, RE::BSTEventSource<RE::SpellsLearned::Event>* src) {
    if(!a_event || !a_event->spell) return RE::BSEventNotifyControl::kContinue;
    CheckCondition();
    
    return RE::BSEventNotifyControl::kContinue;
}
bool SpellLearnedCondition::CheckCondition() {
    RE::SpellItem* target = static_cast<RE::SpellItem*>(GetForm(this->FormID, this->plugin));
    if (RE::PlayerCharacter::GetSingleton()->HasSpell(target)) {
        logger::info("Player met condition learned {}:{}", target->fullName.c_str(), FormIDToString(target->formID));
        this->UnlockNotify();
        RE::SpellsLearned::GetEventSource()->RemoveEventSink(this);
    }
    return false;
}

SpellLearnedConditionFactory::SpellLearnedConditionFactory() : ConditionFactory() {};
Condition* SpellLearnedConditionFactory::createCondition() {
    return new SpellLearnedCondition();
}