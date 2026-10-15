#include "SpellCastCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

SpellCastCondition::SpellCastCondition() : Condition() {}
void SpellCastCondition::OnDataLoaded(void) {
	this->cachedFormID = GetFormID(this->formid, this->plugin);
	if (this->cachedFormID) KeyedSink<RE::TESSpellCastEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
	else logger::error("SpellCast: failed to resolve spell {} in {}", this->formid, this->plugin);
};
void SpellCastCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void SpellCastCondition::SetConditionParameters(std::string formid_a) {
	this->formid = formid_a;
};
bool SpellCastCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl SpellCastCondition::ProcessEvent(const RE::TESSpellCastEvent* a_event, RE::BSTEventSource<RE::TESSpellCastEvent>*) {
	if (a_event && this->cachedFormID && a_event->object && a_event->object->IsPlayerRef() && a_event->spell == this->cachedFormID) {
		logger::info("Player met condition spell cast {}", this->formid);
		this->UnlockNotify();
		KeyedSink<RE::TESSpellCastEvent>::GetSingleton()->Unsubscribe(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};
