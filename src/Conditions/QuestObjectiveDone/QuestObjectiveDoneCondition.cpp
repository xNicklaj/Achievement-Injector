#include "QuestObjectiveDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestObjectiveDoneCondition::QuestObjectiveDoneCondition() : Condition(ConditionType::QuestStageDone) {}
void QuestObjectiveDoneCondition::SetConditionParameters(std::string formID_a, int objective_a) {
    this->formID = formID_a;
    this->objective = objective_a;
}
void QuestObjectiveDoneCondition::OnDataLoaded(void) {
    // Check that quest hasn't been completed already
    this->quest = static_cast<RE::TESQuest*>(GetForm(this->formID, this->plugin));
    CheckCondition();
}
void QuestObjectiveDoneCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);

    // Bind sink for quest stage change event
    auto* eventSourceHolder = RE::ScriptEventSourceHolder::GetSingleton();
    eventSourceHolder->AddEventSink<RE::TESQuestStageEvent>(this);
    RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
}
RE::BSEventNotifyControl QuestObjectiveDoneCondition::ProcessEvent(const RE::TESQuestStageEvent* event, RE::BSTEventSource<RE::TESQuestStageEvent>*) {
    if (!this->isMet && !this->quest && event->formID == this->quest->formID) {
        CheckCondition();
    }

    return RE::BSEventNotifyControl::kContinue;
}
RE::BSEventNotifyControl QuestObjectiveDoneCondition::ProcessEvent(const RE::PositionPlayerEvent*, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
    if (!this->isMet) CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
bool QuestObjectiveDoneCondition::CheckCondition() {
    bool found = false;
    if (this->isMet) return true;
    for (auto& objective_l : quest->objectives) {
		if (objective_l->index != this->objective) continue;
        found = true;
        if(objective_l->state == RE::QUEST_OBJECTIVE_STATE::kFailed) {
            logger::debug("Objective {} for quest {} at stage {} has state kFailed", objective_l->index, this->formID, quest->currentStage);
        } else if (objective_l->state == RE::QUEST_OBJECTIVE_STATE::kCompleted) {
            logger::debug("Objective {} for quest {} at stage {} has state kCompleted", objective_l->index, this->formID, quest->currentStage);
        } else if (objective_l->state == RE::QUEST_OBJECTIVE_STATE::kDormant) {
			logger::debug("Objective {} for quest {} at stage {} has state kDormant", objective_l->index, this->formID, quest->currentStage);
        } else if (objective_l->state == RE::QUEST_OBJECTIVE_STATE::kCompletedDisplayed) {
            logger::debug("Objective {} for quest {} at stage {} has state kCompletedDisplayed", objective_l->index, this->formID, quest->currentStage);
        } else if (objective_l->state == RE::QUEST_OBJECTIVE_STATE::kDisplayed) {
            logger::debug("Objective {} for quest {} at stage {} has state kDisplayed", objective_l->index, this->formID, quest->currentStage);
        }

        if (objective_l->index == this->objective && (objective_l->state == RE::QUEST_OBJECTIVE_STATE::kDisplayed || objective_l->state == RE::QUEST_OBJECTIVE_STATE::kCompletedDisplayed )) {
            logger::info("Player met condition quest {} objective {}", this->formID, this->objective);
            this->UnlockNotify();
            RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink<RE::TESQuestStageEvent>(this);
            RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
            return true;
        }
	}
	logger::debug("Objective {} for quest {} not found or not displayed.", this->objective, this->formID);
    return false;
}

QuestObjectiveDoneConditionFactory::QuestObjectiveDoneConditionFactory() : ConditionFactory() {};
Condition* QuestObjectiveDoneConditionFactory::createCondition() {
    return new QuestObjectiveDoneCondition();
};