#include "ActorDeathCondition.h"


extern void RegisterPostLoadFunction(Condition* condition);

ActorDeathCondition::ActorDeathCondition() : Condition(ConditionType::ActorDeath){};
void ActorDeathCondition::OnDataLoaded(void) {
	// TODO check if actor is already dead
	this->cachedFormID = GetFormID(this->formID, this->plugin);
	if (!this->cachedFormID) {
		logger::error("Form {} not found.", this->formID);
		return;
	}
	KeyedSink<RE::TESDeathEvent>::GetSingleton()->Subscribe(this->cachedFormID, this);
	RE::TESObjectREFR* targetREFR = RE::TESObjectREFR::LookupByID<RE::TESObjectREFR>(this->cachedFormID);
	if(targetREFR && targetREFR->IsDead()) {
		this->UnlockNotify();
		KeyedSink<RE::TESDeathEvent>::GetSingleton()->Unsubscribe(this);
	}
}
void ActorDeathCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void ActorDeathCondition::SetConditionParameters(std::string formID_a) {
	this->formID = formID_a;
};
bool ActorDeathCondition::CheckCondition(RE::FormID) {
	return false;
};
RE::BSEventNotifyControl ActorDeathCondition::ProcessEvent(const RE::TESDeathEvent* a_event, RE::BSTEventSource<RE::TESDeathEvent>*) {
	// 013BB9
	if (!a_event || !a_event->actorDying || !a_event->actorDying->IsDead()) return RE::BSEventNotifyControl::kContinue;
	if (a_event->actorDying->formID == this->cachedFormID) {
		logger::info("Player met condition actor {} dead.", this->formID);
		this->UnlockNotify();
		KeyedSink<RE::TESDeathEvent>::GetSingleton()->Unsubscribe(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};