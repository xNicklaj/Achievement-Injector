#include "ActorDeathCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ActorDeathCondition::ActorDeathCondition() : Condition(ConditionType::ActorDeath){};
void ActorDeathCondition::OnDataLoaded(void) {
	// TODO check if actor is already dead
	auto* target = GetForm(this->formID, this->plugin);
	if (target == NULL) return;
	RE::TESObjectREFR* targetREFR = RE::TESObjectREFR::LookupByID<RE::TESObjectREFR>(target->formID);
	if(targetREFR && targetREFR->IsDead()) {
		this->isMet = true;
		this->eventManager->dispatch("ConditionMet");
		RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
	}
}
void ActorDeathCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
};
void ActorDeathCondition::SetConditionParameters(std::string formID) {
	this->formID = formID;
};
bool ActorDeathCondition::CheckCondition(RE::FormID formid) {
	return false;
};
RE::BSEventNotifyControl ActorDeathCondition::ProcessEvent(const RE::TESDeathEvent* a_event, RE::BSTEventSource<RE::TESDeathEvent>*) {
	// 013BB9
	auto* target = GetForm(this->formID, this->plugin);
	
	if (target == NULL) {
		logger::error("Form {} not found.", this->formID);
		return RE::BSEventNotifyControl::kContinue;
	}
	if (a_event->actorDying->formID == target->formID) {
		logger::info("Player met condition actor {} dead.", this->formID);
		this->isMet = true;
		this->eventManager->dispatch("ConditionMet");
		RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
	}
	return RE::BSEventNotifyControl::kContinue;
};

ActorDeathConditionFactory::ActorDeathConditionFactory() : ConditionFactory() {};
Condition* ActorDeathConditionFactory::createCondition() {
	return new ActorDeathCondition();
};