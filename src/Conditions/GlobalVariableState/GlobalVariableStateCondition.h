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

	RE::TESGlobal* cachedGlobal = nullptr;
protected:
    std::string formID = "";
    float value = -1;
private:
    RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
};

#endif // GLOBAL_VARIABLE_STATE_CONDITION_H
