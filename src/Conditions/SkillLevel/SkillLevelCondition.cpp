#include "SkillLevelCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerSkillLevelCondition::PlayerSkillLevelCondition() : Condition() {}
void PlayerSkillLevelCondition::OnDataLoaded(void) {
    CheckCondition();
}
void PlayerSkillLevelCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::SkillIncrease::GetEventSource()->AddEventSink(this);
}
void PlayerSkillLevelCondition::SetConditionParameters(std::string skill_a, int level_a) {
    this->level = level_a;
    this->skill = skill_a;
    this->cachedSkill = StringToActorValue(skill_a);
    if (this->cachedSkill == RE::ActorValue::kNone) logger::error("SkillLevel: unknown skill \"{}\", this condition can never be met.", skill_a);
}
void PlayerSkillLevelCondition::SetConditionParameters(std::string skill_a, std::string op_a, int level_a) {
    SetConditionParameters(skill_a, level_a);
    this->OP = op_a;
    if (!IsValidOperation(op_a))
        logger::error("SkillLevel: unknown operation \"{}\" for skill {}, this condition can never be met. Use >=, ==, <, <= or !=.", op_a, skill_a);
}
RE::BSEventNotifyControl PlayerSkillLevelCondition::ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>*) {
    if (this->cachedSkill == a_event->actorValue) this->CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerSkillLevelCondition::Evaluate() {
    auto player = RE::PlayerCharacter::GetSingleton();
    if (!player || this->cachedSkill == RE::ActorValue::kNone) return false;
    return CompareValues(this->OP, player->AsActorValueOwner()->GetActorValue(this->cachedSkill), (float)this->level);
}
bool PlayerSkillLevelCondition::CheckCondition() {
    if (!this->isMet && Evaluate()) {
        logger::info("Skill {} met condition level {}", this->skill, this->level);
        this->UnlockNotify();
        StopListening();
        return true;
    }
    return false;
}
void PlayerSkillLevelCondition::StopListening(void) {
    RE::SkillIncrease::GetEventSource()->RemoveEventSink(this);
}
