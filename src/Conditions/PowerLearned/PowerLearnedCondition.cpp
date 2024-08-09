#include "PowerLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PowerLearnedCondition::PowerLearnedCondition() : Condition(ConditionType::PowerLearned) {};
void PowerLearnedCondition::OnDataLoaded(void) {
	
};
void PowerLearnedCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	auto* eventSourceHolder = RE::ScriptEventSourceHolder::GetSingleton();
	eventSourceHolder->AddEventSink(this);
};
void PowerLearnedCondition::SetConditionParameters(std::string formid) {
	this->formid = formid;
};
bool PowerLearnedCondition::CheckCondition() {
};

RE::BSEventNotifyControl PowerLearnedCondition::ProcessEvent(const RE::BGSNewVoicePowerEvent* a_event, RE::BSTEventSource<RE::BGSNewVoicePowerEvent>*) {
	logger::debug("Ciaone");
	return RE::BSEventNotifyControl::kContinue;
}