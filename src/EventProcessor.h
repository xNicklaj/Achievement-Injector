#ifndef EVENT_PROCESSOR_H
#define EVENT_PROCESSOR_H

#pragma once
#include <RE/Skyrim.h>
#include <SKSE/SKSE.h>

#include "Utility.h"

class EventProcessor : public RE::BSTEventSink<RE::MenuOpenCloseEvent>, 
                        public RE::BSTEventSink<RE::InputEvent*>,
                        public RE::BSTEventSink<RE::BGSActorCellEvent>,
                        public RE::BSTEventSink<RE::PositionPlayerEvent> {
public:
    EventProcessor();
    static EventProcessor* GetSingleton() {
        static EventProcessor instance;
        return &instance;
    }

    void EvaluateRequiredCellChanges();

    void Register();
    RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* event,
        RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
    RE::BSEventNotifyControl ProcessEvent(RE::InputEvent* const* a_event, 
        RE::BSTEventSource<RE::InputEvent*>*) override;
    RE::BSEventNotifyControl ProcessEvent(RE::BGSActorCellEvent const* a_event,
        RE::BSTEventSource<RE::BGSActorCellEvent>*) override;
    RE::BSEventNotifyControl ProcessEvent(const RE::PositionPlayerEvent* a_event, 
        RE::BSTEventSource<RE::PositionPlayerEvent>*) override;
private:
    short RequiredPositionPlayerEventCount = 4;
    short PositionPlayerEventCount = 0;
};

#endif  // EVENT_PROCESSOR_H