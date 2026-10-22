#include "PlayerLevelCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerLevelCondition::PlayerLevelCondition() : Condition() {}
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
void PlayerLevelCondition::SetConditionParameters(std::string op_a, int level_a) {
    this->level = level_a;
    this->OP = op_a;
    if (!IsValidOperation(op_a))
        logger::error("PlayerLevel: unknown operation \"{}\", this condition can never be met. Use >=, ==, <, <= or !=.", op_a);
}
RE::BSEventNotifyControl PlayerLevelCondition::ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) {
    if (!this->isMet && CompareValues(this->OP, (float)a_event->newLevel, (float)this->level)) {
        logger::info("Player met condition level {}", this->level);
        this->UnlockNotify();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerLevelCondition::Evaluate() {
    auto player = RE::PlayerCharacter::GetSingleton();
    return player && CompareValues(this->OP, (float)player->GetLevel(), (float)this->level);
}
bool PlayerLevelCondition::CheckCondition() {
    if (!this->isMet && Evaluate()) {
        this->UnlockNotify();
        StopListening();
        return true;
    }
    return false;
}
void PlayerLevelCondition::StopListening(void) {
    RE::LevelIncrease::GetEventSource()->RemoveEventSink(this);
}
