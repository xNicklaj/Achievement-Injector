#ifndef GLOBAL_VARIABLE_STATE_CONDITION_H
#define GLOBAL_VARIABLE_STATE_CONDITION_H

#include "../Condition.h" // Ensure this is the correct path to Condition.h

class GlobalVariableStateCondition : public Condition {
public:
    GlobalVariableStateCondition();
    void OnDataLoaded();
    void EnableListener();
    void SetConditionParameters(std::string formID, float value);
    bool CheckCondition();

private:
    std::string formID;
    float value;
};

class GlobalVariableStateConditionFactory : public ConditionFactory {
public:
	GlobalVariableStateConditionFactory();
	Condition* createCondition();
};

#endif // GLOBAL_VARIABLE_STATE_CONDITION_H
