#include "QuestStageDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestStageDoneCondition::QuestStageDoneCondition() : Condition() {}
void QuestStageDoneCondition::SetConditionParameters(std::string formID_a, std::string OP_a, int stage_a) {
    this->formID = formID_a;
    this->OP = OP_a;
    this->stage = stage_a;
    if (!IsValidOperation(OP_a))
        logger::error("QuestStageDone: unknown operation \"{}\" for quest {}, this condition can never be met. Use >=, ==, <, <= or !=.", OP_a, formID_a);
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
bool QuestStageDoneCondition::Evaluate() {
    // Live conditions skip OnDataLoaded, so resolve lazily
    if (!this->cachedQuest) this->cachedQuest = GetFormOfType<RE::TESQuest>(this->formID, this->plugin);
    return this->cachedQuest && CompareValues(this->OP, (float)this->cachedQuest->GetCurrentStageID(), (float)this->stage);
}
bool QuestStageDoneCondition::CheckCondition() {
    if (this->isMet) return true;
    if (Evaluate()) {
        logger::info("Quest {} met condition stage {}", this->formID, this->stage);
        this->UnlockNotify();
        StopListening();
        return true;
    }
    return false;
}
void QuestStageDoneCondition::StopListening(void) {
    KeyedSink<RE::TESQuestStageEvent>::GetSingleton()->Unsubscribe(this);
}
