#ifndef QUERY_STAT_VALUE_CONDITION_H
#define QUERY_STAT_VALUE_CONDITION_H

#include "../Condition.h" // Ensure this is the correct path to Condition.h

class QueryStatValueCondition : public Condition, RE::BSTEventSink<RE::TESTrackedStatsEvent> {
public:
    QueryStatValueCondition();
    void OnDataLoaded() override;
    void EnableListener() override;
    void StopListening(void) override;
    void SetConditionParameters(std::string stat, float value) override;
    void SetConditionParameters(std::string stat, std::string OP, float value) override;
    bool CheckCondition();
    bool SupportsLive() override { return true; }
    bool Evaluate() override;

private:
    std::string stat = "";
    std::string OP = ">=";
    float value = -1;

    RE::BSEventNotifyControl ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>* a_eventSource) override;
};

#endif // QUERY_STAT_VALUE_CONDITION_H
