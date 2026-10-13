#include "QuestStageDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestStageDoneCondition::QuestStageDoneCondition() : Condition(ConditionType::QuestObjectiveDone) {}
void QuestStageDoneCondition::SetConditionParameters(std::string formID_a, std::string OP_a, int stage_a) {
    this->formID = formID_a;
    this->OP = OP_a;
    this->stage = stage_a;
}
void QuestStageDoneCondition::OnDataLoaded(void) {
    this->cachedQuest = GetFormOfType<RE::TESQuest>(this->formID, this->plugin);
    if (this->cachedQuest) KeyedSink<RE::TESQuestStageEvent>::GetSingleton()->Subscribe(this->cachedQuest->formID, this);
    CheckCondition();
}
void QuestStageDoneCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
}
RE::BSEventNotifyControl QuestStageDoneCondition::ProcessEvent(const RE::TESQuestStageEvent* event, RE::BSTEventSource<RE::TESQuestStageEvent>*) {
    if (!this->isMet && this->cachedQuest && event->formID == this->cachedQuest->formID) {
        CheckCondition();
    }

    return RE::BSEventNotifyControl::kContinue;
}
bool QuestStageDoneCondition::CheckCondition() {
    if (this->isMet) return true;
    if ((this->OP == ">=" || this->OP == "GT") && (this->cachedQuest ? this->cachedQuest->GetCurrentStageID() : 0) >= stage) {
        logger::info("Quest {} met condition stage {}", this->formID, this->stage);
        this->UnlockNotify();
        KeyedSink<RE::TESQuestStageEvent>::GetSingleton()->Unsubscribe(this);
        return true;
    }
    else if ((this->OP == "==" || this->OP == "EQ") && (this->cachedQuest ? this->cachedQuest->GetCurrentStageID() : 0) == stage) {
        logger::info("Quest {} met condition stage {}", this->formID, this->stage);
        this->UnlockNotify();
        KeyedSink<RE::TESQuestStageEvent>::GetSingleton()->Unsubscribe(this);
        return true;
    }
    return false;
}

QuestStageDoneConditionFactory::QuestStageDoneConditionFactory() : ConditionFactory() {};
Condition* QuestStageDoneConditionFactory::createCondition() {
    return new QuestStageDoneCondition();
};