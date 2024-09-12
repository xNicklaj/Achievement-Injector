#include "EventProcessor.h"
#include "Utility.h"
#include "log.h"
#include "AchievementWidget.h"
#include "AchievementMenu.h"
#include "KeyMapping.h"
#include "MessageBox.h"
#include "settings.h"

EventProcessor::EventProcessor() {}

void EventProcessor::EvaluateRequiredCellChanges() {
    //if (CheckIfModIsLoaded("AlternatePerspective.esp")) {
    //    this->RequiredPositionPlayerEventCount = 4;
    //    logger::debug("Alternate Perspective found.");
    //}
    //else if (CheckIfModIsLoaded("alternate start - live another life.esp")) {
    //    this->RequiredPositionPlayerEventCount = 4;
    //    logger::debug("Alternate Start found.");
    //}
    //else if (CheckIfModIsLoaded("Realm of Lorkhan - Custom Alternate Start - Choose your own adventure.esp")) {
    //    this->RequiredPositionPlayerEventCount = 4;
    //    logger::debug("Realm of Lorkhan found.");
    //}
    //else this->RequiredPositionPlayerEventCount = 4;
    if (CheckIfModIsLoaded("Quick Start - SE.esp")) {
        this->RequiredPositionPlayerEventCount = 7;
        logger::debug("Optional Quick Start - SE found.");
    }
    logger::debug("Set RequiredPositionPlayerEventCount to {}", this->RequiredPositionPlayerEventCount);
}

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

    //if (button->GetIDCode() == 201) {//
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

RE::BSEventNotifyControl EventProcessor::ProcessEvent(const RE::PositionPlayerEvent* a_event, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
    short requiredCount = 4;
    if (!Settings::GetSingleton()->bInitialized) {
        this->PositionPlayerEventCount++;
        logger::debug("PositionPlayerEvent happened {} time(s). Required is {}", this->PositionPlayerEventCount, this->RequiredPositionPlayerEventCount);

        if (!Settings::GetSingleton()->GetDelayNewGameAlert() || (Settings::GetSingleton()->GetDelayNewGameAlert() && this->PositionPlayerEventCount >= this->RequiredPositionPlayerEventCount)) {
            std::vector<std::string> args = { "OK" };
            SkyrimScripting::ShowMessageBox("Achievement Injector\n\nTo complete the initialization of Achievement Injector save and load your game. \nUntil this task is completed, achievements will not be listened for.", args, [](int) {});
            Settings::GetSingleton()->bInitialized = true;
        }
    }
    return RE::BSEventNotifyControl::kContinue;
}

void EventProcessor::Register() {
    auto ui = RE::UI::GetSingleton();
    EventProcessor *eventProcessor = EventProcessor::GetSingleton();
	ui->AddEventSink<RE::MenuOpenCloseEvent>(GetSingleton());
    RE::BSInputDeviceManager::GetSingleton()->AddEventSink<RE::InputEvent*>(eventProcessor);
    RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
	logger::debug("Registered event {}"sv, typeid(RE::MenuOpenCloseEvent).name());
}
