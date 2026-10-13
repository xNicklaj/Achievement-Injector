#include "PlayerCrimeCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerCrimeCondition::PlayerCrimeCondition() : Condition(ConditionType::NotSet) {}

void PlayerCrimeCondition::OnDataLoaded(void) {
	this->cachedFactions.clear();
	for (const auto& id : this->factionIDs) {
		auto faction = GetFormOfType<RE::TESFaction>(id, this->plugin);
		if(faction) this->cachedFactions.push_back(faction);
	}
	// Matches any stat whose name contains "Bounty", which no single key covers
	KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->SubscribeAll(this);
	CheckCondition();
}

void PlayerCrimeCondition::EnableListener() {
	RegisterPostLoadFunction(this);
}

void PlayerCrimeCondition::SetConditionParameters(std::vector<std::string> factionIDs_a, int bountyThreshold_a) {
	this->factionIDs = factionIDs_a;
	this->bountyThreshold = bountyThreshold_a;
}

bool PlayerCrimeCondition::CheckCondition() {
	RE::PlayerCharacter* player = RE::PlayerCharacter::GetSingleton();
	if (!player) return false;

	bool allMet = true;
	for (auto faction : this->cachedFactions) {
		uint32_t currentBounty = player->GetCrimeGoldValue(faction);
		if (currentBounty < this->bountyThreshold) {
			allMet = false;
			break;
		}
	}
	if (this->cachedFactions.size() != this->factionIDs.size()) allMet = false;

	if (allMet && this->cachedFactions.size() > 0) {
		logger::info("Player met condition: Faction bounties reached threshold.");
		this->UnlockNotify();
		KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Unsubscribe(this);
		return true;
	}

	return false;
}

RE::BSEventNotifyControl PlayerCrimeCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
	std::string statName = a_event->stat.c_str();
	logger::debug("Tracked stat event: {}", statName);
	if (statName.find("Bounty") != std::string::npos) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}
