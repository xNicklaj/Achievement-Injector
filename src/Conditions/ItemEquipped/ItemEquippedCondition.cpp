#include "ItemEquippedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ItemEquippedCondition::ItemEquippedCondition() : Condition() {}
void ItemEquippedCondition::OnDataLoaded(void) {
	this->cachedFormID = GetFormID(this->formid, this->plugin);
	if (!this->cachedFormID) {
		logger::error("ItemEquipped: failed to resolve item {} in {}", this->formid, this->plugin);
		return;
	}
	KeyedSink<RE::TESEquipEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
	CheckCondition();
};
void ItemEquippedCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void ItemEquippedCondition::SetConditionParameters(std::string formid_a) {
	this->formid = formid_a;
};
// Retro-check for an item that is already worn
bool ItemEquippedCondition::CheckCondition() {
	if (this->isMet || !this->cachedFormID) return false;
	auto player = RE::PlayerCharacter::GetSingleton();
	if (!player) return false;
	for (auto& [item, data] : player->GetInventory()) {
		if (item && item->GetFormID() == this->cachedFormID && data.second && data.second->IsWorn()) {
			logger::info("Player met condition item equipped {}", this->formid);
			this->UnlockNotify();
			KeyedSink<RE::TESEquipEvent>::GetSingleton()->Unsubscribe(this);
			return true;
		}
	}
	return false;
};
RE::BSEventNotifyControl ItemEquippedCondition::ProcessEvent(const RE::TESEquipEvent* a_event, RE::BSTEventSource<RE::TESEquipEvent>*) {
	if (a_event && a_event->equipped && this->cachedFormID && a_event->baseObject == this->cachedFormID && a_event->actor && a_event->actor->IsPlayerRef()) {
		logger::info("Player met condition item equipped {}", this->formid);
		this->UnlockNotify();
		KeyedSink<RE::TESEquipEvent>::GetSingleton()->Unsubscribe(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};
