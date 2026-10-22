#include "FactionRankCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

FactionRankCondition::FactionRankCondition(void) : Condition() {}

void FactionRankCondition::SetConditionParameters(std::string formID, int rank_a) {
	this->formIDStr = formID;
	this->rank = rank_a;
}

void FactionRankCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::UI::GetSingleton()->AddEventSink(this);
}

void FactionRankCondition::OnDataLoaded(void) {
	this->faction = GetFormOfType<RE::TESFaction>(this->formIDStr, this->plugin);
	if (!this->faction) logger::error("FactionRank: failed to find faction {} in {}", this->formIDStr, this->plugin);
	CheckCondition();
}

bool FactionRankCondition::Evaluate() {
	// Live conditions skip OnDataLoaded, so resolve lazily
	if (!this->faction) this->faction = GetFormOfType<RE::TESFaction>(this->formIDStr, this->plugin);
	auto player = RE::PlayerCharacter::GetSingleton();
	// -1 is "not in the faction", so rank 0 means any member
	return this->faction && player && player->GetFactionRank(this->faction, true) >= std::max(this->rank, 0);
}

bool FactionRankCondition::CheckCondition() {
	if (this->isMet || !this->faction) return false;

	if (Evaluate()) {
		this->UnlockNotify();
		StopListening();
		return true;
	}
	return false;
}

RE::BSEventNotifyControl FactionRankCondition::ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
	if (a_event && !a_event->opening) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}
void FactionRankCondition::StopListening(void) {
	RE::UI::GetSingleton()->RemoveEventSink(this);
}
