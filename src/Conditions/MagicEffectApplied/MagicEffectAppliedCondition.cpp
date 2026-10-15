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
bool MagicEffectAppliedCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl MagicEffectAppliedCondition::ProcessEvent(const RE::TESMagicEffectApplyEvent* a_event, RE::BSTEventSource<RE::TESMagicEffectApplyEvent>*) {
	if (a_event && this->cachedFormID && a_event->target && a_event->target->IsPlayerRef() && a_event->magicEffect == this->cachedFormID) {
		logger::info("Player met condition magic effect applied {}", this->formid);
		this->UnlockNotify();
		KeyedSink<RE::TESMagicEffectApplyEvent>::GetSingleton()->Unsubscribe(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};
