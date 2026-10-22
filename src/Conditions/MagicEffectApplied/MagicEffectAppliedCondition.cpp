#include "MagicEffectAppliedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

MagicEffectAppliedCondition::MagicEffectAppliedCondition() : Condition() {}
void MagicEffectAppliedCondition::OnDataLoaded(void) {
	this->cachedFormID = GetFormID(this->formid, this->plugin);
	if (this->cachedFormID) KeyedSink<RE::TESMagicEffectApplyEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
	else logger::error("MagicEffectApplied: failed to resolve effect {} in {}", this->formid, this->plugin);
};
void MagicEffectAppliedCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void MagicEffectAppliedCondition::SetConditionParameters(std::string formid_a) {
	this->formid = formid_a;
};
void MagicEffectAppliedCondition::SetConditionParameters(std::string formid_a, int quantity_a) {
	this->formid = formid_a;
	this->quantity = quantity_a;
};
int MagicEffectAppliedCondition::Serialize() {
	return currQuantity;
}
bool MagicEffectAppliedCondition::Deserialize(int value) {
	this->currQuantity = value;
	return this->currQuantity >= this->quantity;
}
bool MagicEffectAppliedCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl MagicEffectAppliedCondition::ProcessEvent(const RE::TESMagicEffectApplyEvent* a_event, RE::BSTEventSource<RE::TESMagicEffectApplyEvent>*) {
	if (a_event && this->cachedFormID && a_event->target && a_event->target->IsPlayerRef() && a_event->magicEffect == this->cachedFormID) {
		if (++this->currQuantity >= this->quantity) {
			logger::info("Player met condition magic effect applied {}", this->formid);
			this->UnlockNotify();
			StopListening();
		} else this->eventManager->dispatch("SerializationRequested");
	}
	return RE::BSEventNotifyControl::kContinue;
};
void MagicEffectAppliedCondition::StopListening(void) {
	KeyedSink<RE::TESMagicEffectApplyEvent>::GetSingleton()->Unsubscribe(this);
}
