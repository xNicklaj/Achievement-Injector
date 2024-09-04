#include "EventProcessor.h"
#include "Utility.h"
#include "log.h"
#include "AchievementWidget.h"
#include "AchievementMenu.h"
#include "KeyMapping.h"

RE::BSEventNotifyControl EventProcessor::ProcessEvent(const RE::MenuOpenCloseEvent* event,
                                                      RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
    if (!event) {
        return RE::BSEventNotifyControl::kContinue;
    }

    auto ui = RE::UI::GetSingleton();
    if (event->opening) {
        if (event->menuName == "Journal Menu") {
            Scaleform::AchievementMenuInjector::Inject();
        }
    } else if (!event->opening && event->menuName == Scaleform::AchievementWidget::MENU_NAME) {
        Scaleform::AchievementWidget::Show();
    }
    return RE::BSEventNotifyControl::kContinue;
}

RE::BSEventNotifyControl EventProcessor::ProcessEvent(RE::InputEvent* const* a_event, RE::BSTEventSource<RE::InputEvent*>*) {
    if (!a_event || !*a_event || !RE::Main::GetSingleton()->gameActive) {
        return RE::BSEventNotifyControl::kContinue;
    }
    
    auto* event = *a_event;
    auto* button = event->AsButtonEvent();

    if(!button) {
		return RE::BSEventNotifyControl::kContinue;
	}

    //if (button->GetIDCode() == 201) {
    //    Scaleform::AchievementMenu::Show();
    //    logger::debug("PgUP");
    //}
    //else if (button->GetIDCode() == 209) {
    //    Scaleform::AchievementMenu::Hide();
    //    logger::debug("PgDOWN");
    //}
    return RE::BSEventNotifyControl::kContinue;
}

RE::BSEventNotifyControl EventProcessor::ProcessEvent(RE::BGSActorCellEvent const* a_event,
    RE::BSTEventSource<RE::BGSActorCellEvent>*) {
    return  RE::BSEventNotifyControl::kContinue;
}

void EventProcessor::Register() {
    auto ui = RE::UI::GetSingleton();
    EventProcessor *eventProcessor = EventProcessor::GetSingleton();
	ui->AddEventSink<RE::MenuOpenCloseEvent>(GetSingleton());
    RE::BSInputDeviceManager::GetSingleton()->AddEventSink<RE::InputEvent*>(eventProcessor);
	logger::debug("Registered event {}"sv, typeid(RE::MenuOpenCloseEvent).name());
}
