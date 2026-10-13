#ifndef EVENT_PROCESSOR_H
#define EVENT_PROCESSOR_H

#pragma once
#include <RE/Skyrim.h>
#include <SKSE/SKSE.h>
#include <eventpp/eventdispatcher.h>

#include "Utility.h"

class EventProcessor : public RE::BSTEventSink<RE::MenuOpenCloseEvent> {
public:
    EventProcessor();
    static EventProcessor* GetSingleton() {
        static EventProcessor instance;
        return &instance;
    }

    void Register();
    RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* event,
        RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;

    eventpp::EventDispatcher<std::string, void(void)> eventHandler;
};

#endif  // EVENT_PROCESSOR_H
