#include "HasPerkCondition.h"

HasPerkCondition::HasPerkCondition(void) : Condition(ConditionType::HasPerk) {}

void HasPerkCondition::SetConditionParameters(std::string formID) {
	this->formIDStr = formID;
}

void HasPerkCondition::EnableListener(void) {
	RE::UI::GetSingleton()->AddEventSink(this);
}

void HasPerkCondition::OnDataLoaded(void) {
	this->perk = GetFormOfType<RE::BGSPerk>(this->formIDStr, this->plugin);
	if (!this->perk) {
		logger::error("Failed to find perk {}", this->formIDStr);
	}
	CheckCondition();
}

bool HasPerkCondition::CheckCondition() {
	if (this->isMet) return false;
	
	if (!this->perk) {
		this->perk = GetFormOfType<RE::BGSPerk>(this->formIDStr, this->plugin);
	}
	
	if (!this->perk) return false;
	
	auto player = RE::PlayerCharacter::GetSingleton();
	if (player && player->HasPerk(this->perk)) {
		this->UnlockNotify();
		RE::UI::GetSingleton()->RemoveEventSink(this);
		return true;
	}
	
	return false;
}

RE::BSEventNotifyControl HasPerkCondition::ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
	if (a_event && !a_event->opening) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}

HasPerkConditionFactory::HasPerkConditionFactory() : ConditionFactory() {}

Condition* HasPerkConditionFactory::createCondition() {
	return new HasPerkCondition();
}
