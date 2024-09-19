#include "QuestStageDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestStageDoneCondition::QuestStageDoneCondition() : Condition(ConditionType::QuestObjectiveDone) {}
void QuestStageDoneCondition::SetConditionParameters(std::string formID_a, std::string OP_a, int stage_a) {
    this->formID = formID_a;
    this->OP = OP_a;
    this->stage = stage_a;
}
void QuestStageDoneCondition::OnDataLoaded(void) {
    // Check that quest hasn't been completed already
    CheckCondition();
}
void QuestStageDoneCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);

    // Bind sink for quest stage change event
    auto* eventSourceHolder = RE::ScriptEventSourceHolder::GetSingleton();
    eventSourceHolder->AddEventSink(this);
}
RE::BSEventNotifyControl QuestStageDoneCondition::ProcessEvent(const RE::TESQuestStageEvent* event, RE::BSTEventSource<RE::TESQuestStageEvent>*) {
    const auto quest = GetForm(this->formID, this->plugin);
    if (!this->isMet && event->formID == quest->formID) {
        CheckCondition();
    }

    return RE::BSEventNotifyControl::kContinue;
}
bool QuestStageDoneCondition::CheckCondition() {
    if (this->isMet) return true;
    if ((this->OP == ">=" || this->OP == "GT") && CheckQuestStage(this->formID, this->plugin) >= stage) {
        logger::info("Quest {} met condition stage {}", this->formID, this->stage);
        this->UnlockNotify();
        RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
        return true;
    }
    else if ((this->OP == "==" || this->OP == "EQ") && CheckQuestStage(this->formID, this->plugin) == stage) {
        logger::info("Quest {} met condition stage {}", this->formID, this->stage);
        this->UnlockNotify();
        RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
        return true;
    }
    return false;
}

QuestStageDoneConditionFactory::QuestStageDoneConditionFactory() : ConditionFactory() {};
Condition* QuestStageDoneConditionFactory::createCondition() {
    return new QuestStageDoneCondition();
};