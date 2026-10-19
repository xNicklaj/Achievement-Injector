#include "GlobalVariableStateCondition.h"
#include "../../CommonFunctions.h"

extern void RegisterPostLoadFunction(Condition* condition);

GlobalVariableStateCondition::GlobalVariableStateCondition(void) : Condition() {};
void GlobalVariableStateCondition::OnDataLoaded(void) {
	this->cachedGlobal = GetFormOfType<RE::TESGlobal>(this->formID, this->plugin);
	CheckCondition();
};
void GlobalVariableStateCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
};
void GlobalVariableStateCondition::SetConditionParameters(std::string formID_a, float value_a) {
	this->formID = formID_a;
	this->value = value_a;
};
void GlobalVariableStateCondition::SetConditionParameters(std::string formID_a, std::string OP_a, float value_a) {
	SetConditionParameters(formID_a, value_a);
	this->OP = OP_a;
	if (!IsValidOperation(OP_a))
		logger::error("GlobalVariableState: unknown operation \"{}\" for global {}, this condition can never be met. Use >= or ==.", OP_a, formID_a);
};
bool GlobalVariableStateCondition::CheckCondition() {
	if(this->isMet) return true;
	if (!this->cachedGlobal) return false;
	float globValue = this->cachedGlobal->value;
	if(CompareValues(this->OP, globValue, this->value)) {
		this->UnlockNotify();
		RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
		return true;
	}
	return false;
};

RE::BSEventNotifyControl GlobalVariableStateCondition::ProcessEvent(const RE::PositionPlayerEvent*, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
	if (!this->isMet) CheckCondition();
	return RE::BSEventNotifyControl::kContinue;
}