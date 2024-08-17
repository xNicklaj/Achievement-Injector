#include "GlobalVariableStateCondition.h"
#include "../../CommonFunctions.h"

extern void RegisterPostLoadFunction(Condition* condition);

GlobalVariableStateCondition::GlobalVariableStateCondition(void) : Condition(ConditionType::GlobalVariableState) {};
void GlobalVariableStateCondition::OnDataLoaded(void) {
	CheckCondition();
};
void GlobalVariableStateCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void GlobalVariableStateCondition::SetConditionParameters(std::string formID, float value) {
	this->formID = formID;
	this->value = value;
};
bool GlobalVariableStateCondition::CheckCondition() {
	RE::TESForm* target = GetForm(this->formID, this->plugin);
	if (!target) return false;
	float globValue = GetGlobalVariableValue(target->formID);
	if(globValue >= this->value) {
		this->UnlockNotify();
		return true;
	}
	return false;
};

// GlobalVariableStateConditionFactory
GlobalVariableStateConditionFactory::GlobalVariableStateConditionFactory() : ConditionFactory() {};
Condition* GlobalVariableStateConditionFactory::createCondition() {
	return new GlobalVariableStateCondition();
};