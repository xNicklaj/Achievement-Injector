#include "../Condition.h"

#ifndef OBJECT_ENABLED_CONDITION_H
#define OBJECT_ENABLED_CONDITION_H

class ObjectStateCondition : public Condition, public RE::BSTEventSink<RE::PositionPlayerEvent> {
public:
    ObjectStateCondition();
    void OnDataLoaded() override;
    void EnableListener() override;
    void SetConditionParameters(std::string formID, bool state) override;
    bool CheckCondition();

private:
    std::string formID = "";
    bool state = false;
    RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
};

class ObjectStateConditionFactory : public ConditionFactory {
    public:
        ObjectStateConditionFactory();
        Condition* createCondition() override;
};

#endif