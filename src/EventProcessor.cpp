#include "EventProcessor.h"
#include "Utility.h"
#include "log.h"
#include "AchievementWidget.h"

RE::BSEventNotifyControl EventProcessor::ProcessEvent(const RE::MenuOpenCloseEvent* event,
                                                      RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
    if (!event) {
        return RE::BSEventNotifyControl::kContinue;
    }

    auto ui = RE::UI::GetSingleton();
    if (event->opening) {
        
    } else if (!event->opening && event->menuName == Scaleform::AchievementWidget::MENU_NAME) {
        Scaleform::AchievementWidget::Show();
    }
    return RE::BSEventNotifyControl::kContinue;
}

void EventProcessor::Register() {
auto ui = RE::UI::GetSingleton();
	ui->AddEventSink<RE::MenuOpenCloseEvent>(GetSingleton());
	logger::debug("Registered event {}"sv, typeid(RE::MenuOpenCloseEvent).name());
}