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
    bool SupportsLive() override { return true; }
    bool Evaluate() override;

	RE::TESObjectREFR* cachedRef = nullptr;
private:
    std::string formID = "";
    bool state = false;
    RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
};

#endif