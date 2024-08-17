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
void PlayerSkillLevelCondition::SetConditionParameters(std::string skill, int level) {
    this->level = level;
    this->skill = skill;
}
RE::BSEventNotifyControl PlayerSkillLevelCondition::ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>* src) {
    if (StringToActorValue(this->skill) == a_event->actorValue) this->CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerSkillLevelCondition::CheckCondition() {
    RE::ActorValue skill = StringToActorValue(this->skill);
    float skillLevel = RE::PlayerCharacter::GetSingleton()->AsActorValueOwner()->GetActorValue(skill);
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