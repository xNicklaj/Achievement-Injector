#include "PlayerActivationCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerActivationCondition::PlayerActivationCondition() : Condition(PlayerActivation) {}
void PlayerActivationCondition::OnDataLoaded(void) {
	this->cachedFormID = GetFormID(this->formid, this->plugin);
	if (this->cachedFormID) KeyedSink<RE::TESActivateEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
};
void PlayerActivationCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void PlayerActivationCondition::SetConditionParameters(std::string formid_a) {
	this->formid = formid_a;
};
bool PlayerActivationCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl PlayerActivationCondition::ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) {
	if (this->cachedFormID && a_event->actionRef && a_event->actionRef->IsPlayerRef() && a_event->objectActivated && a_event->objectActivated->GetFormID() == this->cachedFormID) {
		logger::info("Player met condition activation {}", this->formid);
		this->UnlockNotify();
		KeyedSink<RE::TESActivateEvent>::GetSingleton()->Unsubscribe(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};