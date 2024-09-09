#include "QuestObjectiveDoneCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

QuestObjectiveDoneCondition::QuestObjectiveDoneCondition() : Condition(ConditionType::QuestStageDone) {}
void QuestObjectiveDoneCondition::SetConditionParameters(std::string formID, int objective) {
    this->formID = formID;
    this->objective = objective;
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
    if (!this->isMet && event->formID == quest->formID) {
        CheckCondition();
    }

    return RE::BSEventNotifyControl::kContinue;
}
RE::BSEventNotifyControl QuestObjectiveDoneCondition::ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
    if (!this->isMet) CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
bool QuestObjectiveDoneCondition::CheckCondition() {
    if (this->isMet) return true;
    logger::debug("Analyzing quest {}...", quest->fullName.c_str());
    logger::debug("Quest {} is at stage {}", quest->fullName.c_str(), quest->currentStage);
    for (auto& objective : quest->objectives) {
        if(objective->state == RE::QUEST_OBJECTIVE_STATE::kFailed) {
            logger::debug("Objective \"{}\" has state kFailed", objective->displayText.c_str());
        } else if (objective->state == RE::QUEST_OBJECTIVE_STATE::kCompleted) {
            logger::debug("Objective \"{}\" has state kCompleted", objective->displayText.c_str());
        } else if (objective->state == RE::QUEST_OBJECTIVE_STATE::kDormant) {
			logger::debug("Objective \"{}\" has state kDormant", objective->displayText.c_str());
        } else if (objective->state == RE::QUEST_OBJECTIVE_STATE::kCompletedDisplayed) {
            logger::debug("Objective \"{}\" has state kCompletedDisplayed", objective->displayText.c_str());
        } else if (objective->state == RE::QUEST_OBJECTIVE_STATE::kDisplayed) {
            logger::debug("Objective \"{}\" has state kDisplayed", objective->displayText.c_str());
        }

        if (objective->index == this->objective && objective->initialized && objective->state == RE::QUEST_OBJECTIVE_STATE::kCompleted) {
            logger::info("Player met condition quest {} objective {}", this->formID, this->objective);
            this->UnlockNotify();
            RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink<RE::TESQuestStageEvent>(this);
            RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
            return true;
        }
	}
    return false;
}

QuestObjectiveDoneConditionFactory::QuestObjectiveDoneConditionFactory() : ConditionFactory() {};
Condition* QuestObjectiveDoneConditionFactory::createCondition() {
    return new QuestObjectiveDoneCondition();
};