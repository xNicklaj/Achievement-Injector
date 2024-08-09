#include "QuestStageDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestStageDoneCondition::QuestStageDoneCondition() : Condition(ConditionType::QuestStageDone) {}
void QuestStageDoneCondition::SetConditionParameters(std::string questId, int stage) {
    this->questId = questId;
    this->stage = stage;
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
    const auto quest = RE::TESForm::LookupByEditorID<RE::TESQuest>(this->questId);
    if (!this->isMet && event->formID == quest->formID) {
        CheckCondition();
    }

    return RE::BSEventNotifyControl::kContinue;
}
bool QuestStageDoneCondition::CheckCondition() {
    if (!this->isMet && CheckQuestStage(this->questId, this->plugin) >= stage) { // TODO dynamic esp
        logger::info("Quest {} met condition stage {}", this->questId, this->stage);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
        return true;
    }
    return false;
}

QuestStageDoneConditionFactory::QuestStageDoneConditionFactory() : ConditionFactory() {};
Condition* QuestStageDoneConditionFactory::createCondition() {
    return new QuestStageDoneCondition();
};