#include "PlayerActivationCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerActivationCondition::PlayerActivationCondition() : Condition() {}
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
void PlayerActivationCondition::SetConditionParameters(std::string formid_a, int quantity_a) {
	this->formid = formid_a;
	this->quantity = quantity_a;
};
int PlayerActivationCondition::Serialize() {
	return currQuantity;
}
bool PlayerActivationCondition::Deserialize(int value) {
	this->currQuantity = value;
	return this->currQuantity >= this->quantity;
}
bool PlayerActivationCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl PlayerActivationCondition::ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) {
	if (this->cachedFormID && a_event->actionRef && a_event->actionRef->IsPlayerRef() && a_event->objectActivated && a_event->objectActivated->GetFormID() == this->cachedFormID) {
		if (++this->currQuantity >= this->quantity) {
			logger::info("Player met condition activation {}", this->formid);
			this->UnlockNotify();
			StopListening();
		} else this->eventManager->dispatch("SerializationRequested");
	}
	return RE::BSEventNotifyControl::kContinue;
};
void PlayerActivationCondition::StopListening(void) {
	KeyedSink<RE::TESActivateEvent>::GetSingleton()->Unsubscribe(this);
}
