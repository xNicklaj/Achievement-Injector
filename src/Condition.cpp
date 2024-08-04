#include "Condition.h"
#include "log.h"
#include <SKSE/SKSE.h>
#include <RE/Skyrim.h>
#include <functional>

extern void RegisterPostLoadFunction(Condition* condition);

Condition::Condition(ConditionType type) {
    this->type = type;
}
void Condition::EnableListener() {}
void Condition::OnDataLoaded() {
    CheckCondition();
}
void Condition::SetConditionParameters(std::string questId, int stage){}
void Condition::SetConditionParameters(int level) {}
bool Condition::CheckCondition() { return false; }
void Condition::SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager) {
	this->eventManager = eventManager;
}

// QuestStageDoneCondition

QuestStageDoneCondition::QuestStageDoneCondition() : Condition(ConditionType::QuestStageDone) {}
void QuestStageDoneCondition::SetConditionParameters(std::string questId, int stage) {
    this->questId = questId;
    this->stage = stage;
}
void QuestStageDoneCondition::OnDataLoaded(void){
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
    if (!this->isMet && CheckQuestStage(this->questId, "Skyrim.esm") >= stage) {
        logger::info("Quest {} met condition stage {}", this->questId, this->stage);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        return true;
    }
    return false;
}

// PlayerLevelCondition
PlayerLevelCondition::PlayerLevelCondition() : Condition(ConditionType::PlayerLevel) {}
void PlayerLevelCondition::OnDataLoaded(void) {
    CheckCondition();
}
void PlayerLevelCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::LevelIncrease::GetEventSource()->AddEventSink(this);
}
void PlayerLevelCondition::SetConditionParameters(int level) {
	this->level = level;
}
RE::BSEventNotifyControl PlayerLevelCondition::ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) {
    if (!this->isMet && a_event->newLevel >= this->level) {
        logger::info("Player met condition level {}", this->level);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool PlayerLevelCondition::CheckCondition() {
	if (!this->isMet && RE::PlayerCharacter::GetSingleton()->GetLevel() >= level) {
		this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
		return true;
	}
    return false;
}

// PlayerSkillLevelCondition
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
		this->isMet = true;
		this->eventManager->dispatch("ConditionMet");
		return true;
	}
    return false;
}

// ItemInInventoryCondition
ItemInInventoryCondition::ItemInInventoryCondition() : Condition(ConditionType::ItemInInventory) {}
void ItemInInventoryCondition::OnDataLoaded(void) {
    CheckCondition();
}
void ItemInInventoryCondition::EnableListener() {
	RegisterPostLoadFunction(this);
    RE::ScriptEventSourceHolder* eventSourceHolder = RE::ScriptEventSourceHolder::GetSingleton();
    eventSourceHolder->AddEventSink(this);
}
void ItemInInventoryCondition::SetConditionParameters(std::string formid, int quantity) {
    this->formid = formid;
	this->quantity = quantity;
}
RE::BSEventNotifyControl ItemInInventoryCondition::ProcessEvent(const RE::TESContainerChangedEvent* a_event, RE::BSTEventSource<RE::TESContainerChangedEvent>*) {
    if (a_event->baseObj == RE::PlayerCharacter::GetSingleton()->formID) {
        CheckCondition();
    }
    return RE::BSEventNotifyControl::kContinue;
}
bool ItemInInventoryCondition::CheckCondition() {
    RE::PlayerCharacter* player = RE::PlayerCharacter::GetSingleton();
    int quantity = 0;

    const auto inventory = RE::PlayerCharacter::GetSingleton()->GetInventory();
    for (auto& [item, data] : inventory) {
        if(item != NULL) logger::debug("ITEM: {} {}", item->GetFormID(), item->GetName());
        if (item != NULL && FormIDToString(item->GetFormID()) == this->formid) {
			quantity += 1;
		}
    }
    if(quantity >= this->quantity){
        logger::info("Player met condition item {} quantity {}", this->formid, this->quantity);
        this->isMet = true;
        this->eventManager->dispatch("ConditionMet");
        return true;
    }
    return false;
}


// QuestStageDoneConditionFactory

QuestStageDoneConditionFactory::QuestStageDoneConditionFactory() : ConditionFactory() {};

Condition* QuestStageDoneConditionFactory::createCondition() {
    return new QuestStageDoneCondition();
};

PlayerLevelConditionFactory::PlayerLevelConditionFactory() : ConditionFactory() {};

Condition* PlayerLevelConditionFactory::createCondition() {
	return new PlayerLevelCondition();
};

PlayerSkillLevelConditionFactory::PlayerSkillLevelConditionFactory() : ConditionFactory() {};

Condition* PlayerSkillLevelConditionFactory::createCondition() {
	return new PlayerSkillLevelCondition();
};

ItemInInventoryConditionFactory::ItemInInventoryConditionFactory() : ConditionFactory() {};

Condition* ItemInInventoryConditionFactory::createCondition() {
	return new ItemInInventoryCondition();
};