#include "PlayerLevelCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerLevelCondition::PlayerLevelCondition() : Condition(ConditionType::PlayerLevel) {}
void PlayerLevelCondition::OnDataLoaded(void) {
    CheckCondition();
}
void PlayerLevelCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::LevelIncrease::GetEventSource()->AddEventSink(this);
}
void PlayerLevelCondition::SetConditionParameters(int level_a) {
    this->level = level_a;
}
RE::BSEventNotifyControl PlayerLevelCondition::ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) {
    if (!this->isMet && a_event->newLevel >= this->level) {
        logger::info("Player met condition level {}", this->level);
        this->UnlockNotify();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerLevelCondition::CheckCondition() {
    if (!this->isMet && RE::PlayerCharacter::GetSingleton()->GetLevel() >= level) {
        this->UnlockNotify();
        RE::LevelIncrease::GetEventSource()->RemoveEventSink(this);
        return true;
    }
    return false;
}

PlayerLevelConditionFactory::PlayerLevelConditionFactory() : ConditionFactory() {};
Condition* PlayerLevelConditionFactory::createCondition() {
    return new PlayerLevelCondition();
};