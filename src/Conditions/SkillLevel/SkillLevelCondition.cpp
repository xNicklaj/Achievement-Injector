#include "SkillLevelCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerSkillLevelCondition::PlayerSkillLevelCondition() : Condition(ConditionType::PlayerLevel) {}
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
}
RE::BSEventNotifyControl PlayerSkillLevelCondition::ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>*) {
    if (StringToActorValue(this->skill) == a_event->actorValue) this->CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerSkillLevelCondition::CheckCondition() {
    RE::ActorValue skill_l = StringToActorValue(this->skill);
    float skillLevel = RE::PlayerCharacter::GetSingleton()->AsActorValueOwner()->GetActorValue(skill_l);
    if (!this->isMet && skillLevel >= this->level) {
        logger::info("Skill {} met condition level {}", this->skill, skillLevel);
        this->UnlockNotify();
        RE::SkillIncrease::GetEventSource()->RemoveEventSink(this);
        return true;
    }
    return false;
}

PlayerSkillLevelConditionFactory::PlayerSkillLevelConditionFactory() : ConditionFactory() {};
Condition* PlayerSkillLevelConditionFactory::createCondition() {
    return new PlayerSkillLevelCondition();
}