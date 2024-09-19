#include "QueryStatValueCondition.h"
#include "../../CustomRE.h"

extern void RegisterPostLoadFunction(Condition* condition);

QueryStatValueCondition::QueryStatValueCondition(void) : Condition(ConditionType::QueryStatValue) {};
void QueryStatValueCondition::OnDataLoaded(void) {
	CheckCondition();
};
void QueryStatValueCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void QueryStatValueCondition::SetConditionParameters(std::string stat_a, float value_a) {
	this->stat = stat_a;
	this->value = value_a;
};
bool QueryStatValueCondition::CheckCondition() {
	int32_t globValue = RE::QueryStat(this->stat.c_str());
	if (globValue >= this->value) {
		this->UnlockNotify();
		return true;
	}
	return false;
};
RE::BSEventNotifyControl QueryStatValueCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
	if(strcmp(a_event->stat.c_str(), this->stat.c_str()) == 0) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
};

// GlobalVariableStateConditionFactory
QueryStatValueConditionFactory::QueryStatValueConditionFactory() : ConditionFactory() {};
Condition* QueryStatValueConditionFactory::createCondition() {
	return new QueryStatValueCondition();
};