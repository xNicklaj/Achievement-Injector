#include "HasPerkCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

HasPerkCondition::HasPerkCondition(void) : Condition() {}

void HasPerkCondition::SetConditionParameters(std::string formID) {
	this->formIDStr = formID;
}

void HasPerkCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::UI::GetSingleton()->AddEventSink(this);
}

void HasPerkCondition::OnDataLoaded(void) {
	this->perk = GetFormOfType<RE::BGSPerk>(this->formIDStr, this->plugin);
	if (!this->perk) {
		logger::error("Failed to find perk {}", this->formIDStr);
	}
	CheckCondition();
}

bool HasPerkCondition::Evaluate() {
	// Live conditions skip OnDataLoaded, so resolve lazily
	if (!this->perk) {
		this->perk = GetFormOfType<RE::BGSPerk>(this->formIDStr, this->plugin);
	}
	auto player = RE::PlayerCharacter::GetSingleton();
	return this->perk && player && player->HasPerk(this->perk);
}

bool HasPerkCondition::CheckCondition() {
	if (this->isMet) return false;

	if (Evaluate()) {
		this->UnlockNotify();
		StopListening();
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
void HasPerkCondition::StopListening(void) {
	RE::UI::GetSingleton()->RemoveEventSink(this);
}
