#include "PlayerActivationCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PlayerActivationCondition::PlayerActivationCondition() : Condition(PlayerActivation) {}
void PlayerActivationCondition::OnDataLoaded(void) {
};
void PlayerActivationCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
};
void PlayerActivationCondition::SetConditionParameters(std::string formid_a) {
	this->formid = formid_a;
};
bool PlayerActivationCondition::CheckCondition() {
	return false;
};
RE::BSEventNotifyControl PlayerActivationCondition::ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) {
	RE::TESForm* target = GetForm(this->formid, this->plugin);
	if (target == NULL) return RE::BSEventNotifyControl::kContinue;
	if (a_event->objectActivated->GetFormID() == target->formID) {
		logger::info("Player met condition activation {}", this->formid);
		this->UnlockNotify();
	}
	return RE::BSEventNotifyControl::kContinue;
};

PlayerActivationConditionFactory::PlayerActivationConditionFactory() : ConditionFactory() {};
Condition* PlayerActivationConditionFactory::createCondition() {
	return new PlayerActivationCondition();
};