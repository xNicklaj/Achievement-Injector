#ifndef GLOBAL_VARIABLE_STATE_CONDITION_H
#define GLOBAL_VARIABLE_STATE_CONDITION_H

#include "../Condition.h" // Ensure this is the correct path to Condition.h

class GlobalVariableStateCondition : public Condition, public RE::BSTEventSink<RE::PositionPlayerEvent> {
public:
    GlobalVariableStateCondition();
    void OnDataLoaded() override;
    void EnableListener() override;
    void SetConditionParameters(std::string formID, float value) override;
    bool CheckCondition();

private:
    std::string formID = "";
    float value = -1;
    RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
};

class GlobalVariableStateConditionFactory : public ConditionFactory {
public:
	GlobalVariableStateConditionFactory();
	Condition* createCondition() override;
};

#endif // GLOBAL_VARIABLE_STATE_CONDITION_H
