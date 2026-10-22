#include "QueryStatValueCondition.h"
#include "../../CustomRE.h"

extern void RegisterPostLoadFunction(Condition* condition);

QueryStatValueCondition::QueryStatValueCondition(void) : Condition() {};
void QueryStatValueCondition::OnDataLoaded(void) {
	KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Subscribe(StatKey(this->stat), this);
	CheckCondition();
};
void QueryStatValueCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
};
void QueryStatValueCondition::SetConditionParameters(std::string stat_a, float value_a) {
	this->stat = stat_a;
	this->value = value_a;
};
void QueryStatValueCondition::SetConditionParameters(std::string stat_a, std::string OP_a, float value_a) {
	SetConditionParameters(stat_a, value_a);
	this->OP = OP_a;
	if (!IsValidOperation(OP_a))
		logger::error("QueryStatValue: unknown operation \"{}\" for stat {}, this condition can never be met. Use >=, ==, <, <= or !=.", OP_a, stat_a);
};
void QueryStatValueCondition::StopListening(void) {
	KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Unsubscribe(this);
}
bool QueryStatValueCondition::Evaluate() {
	return CompareValues(this->OP, (float)RE::QueryStat(this->stat.c_str()), this->value);
}
bool QueryStatValueCondition::CheckCondition() {
	if (Evaluate()) {
		this->UnlockNotify();
		StopListening();
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