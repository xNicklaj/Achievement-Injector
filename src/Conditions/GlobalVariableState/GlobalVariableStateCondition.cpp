#include "GlobalVariableStateCondition.h"
#include "../../CommonFunctions.h"

extern void RegisterPostLoadFunction(Condition* condition);

GlobalVariableStateCondition::GlobalVariableStateCondition(void) : Condition(ConditionType::GlobalVariableState) {};
void GlobalVariableStateCondition::OnDataLoaded(void) {
	CheckCondition();
};
void GlobalVariableStateCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
};
void GlobalVariableStateCondition::SetConditionParameters(std::string formID, float value) {
	this->formID = formID;
	this->value = value;
};
bool GlobalVariableStateCondition::CheckCondition() {
	if(this->isMet) return true;
	RE::TESForm* target = GetForm(this->formID, this->plugin);
	if (!target) return false;
	float globValue = GetGlobalVariableValue(target->formID);
	if(globValue >= this->value) {
		this->UnlockNotify();
		RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
		return true;
	}
	return false;
};

RE::BSEventNotifyControl GlobalVariableStateCondition::ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
	if (!this->isMet) CheckCondition();
	return RE::BSEventNotifyControl::kContinue;
}

// GlobalVariableStateConditionFactory
GlobalVariableStateConditionFactory::GlobalVariableStateConditionFactory() : ConditionFactory() {};
Condition* GlobalVariableStateConditionFactory::createCondition() {
	return new GlobalVariableStateCondition();
};