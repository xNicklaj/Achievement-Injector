#include "HasPerksCondition.h"

HasPerksCondition::HasPerksCondition(void) : Condition(ConditionType::HasPerks) {}

void HasPerksCondition::SetConditionParameters(std::vector<std::string> formIDs_a, int threshold_a) {
	this->formIDs = formIDs_a;
	this->threshold = threshold_a;
}

void HasPerksCondition::EnableListener(void) {
	RE::UI::GetSingleton()->AddEventSink(this);
}

void HasPerksCondition::OnDataLoaded(void) {
	this->perks.clear();
	for (const auto& formIDStr : this->formIDs) {
		auto perk = GetFormOfType<RE::BGSPerk>(formIDStr, this->plugin);
		if (perk) {
			this->perks.push_back(perk);
		} else {
			logger::error("Failed to find perk {}", formIDStr);
		}
	}
	CheckCondition();
}

bool HasPerksCondition::CheckCondition() {
	if (this->isMet) return false;
	
	if (this->perks.empty()) {
		for (const auto& formIDStr : this->formIDs) {
			auto perk = GetFormOfType<RE::BGSPerk>(formIDStr, this->plugin);
			if (perk) {
				this->perks.push_back(perk);
			}
		}
	}
	
	if (this->perks.empty()) return false;
	
	auto player = RE::PlayerCharacter::GetSingleton();
	if (!player) return false;
	
	int count = 0;
	for (auto perk : this->perks) {
		if (player->HasPerk(perk)) {
			count++;
		}
	}
	
	if (count >= this->threshold) {
		this->UnlockNotify();
		RE::UI::GetSingleton()->RemoveEventSink(this);
		return true;
	}
	
	return false;
}

RE::BSEventNotifyControl HasPerksCondition::ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
	if (a_event && !a_event->opening) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}

HasPerksConditionFactory::HasPerksConditionFactory() : ConditionFactory() {}

Condition* HasPerksConditionFactory::createCondition() {
	return new HasPerksCondition();
}
