#include "EventProcessor.h"
#include "Utility.h"
#include "log.h"
#include "AchievementWidget.h"
#include "AchievementMenu.h"
#include "settings.h"

EventProcessor::EventProcessor() {}

RE::BSEventNotifyControl EventProcessor::ProcessEvent(const RE::MenuOpenCloseEvent* event,
                                                      RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
    if (!event) {
        return RE::BSEventNotifyControl::kContinue;
    }

    if (event->opening) {
        if (event->menuName == "Journal Menu") {
            Scaleform::AchievementMenuInjector::Inject();
        }
    } else if (!event->opening && event->menuName == Scaleform::AchievementWidget::MENU_NAME) {
        Scaleform::AchievementWidget::Show();
    }

    // The popup must sit above the HUD (depth 2) but below the tween menu (depth 0), which depth alone
    // cannot express: hide it while the tween menu is up
    if (event->menuName == RE::TweenMenu::MENU_NAME) {
        auto menu = RE::UI::GetSingleton()->GetMenu(Scaleform::AchievementWidget::MENU_NAME);
        if (menu && menu->uiMovie) menu->uiMovie->SetVisible(!event->opening);
    }

    if (!event->opening && event->menuName == "RaceSex Menu") {
        logger::debug("RaceMenu closed. Player's name is: {}", RE::PlayerCharacter::GetSingleton()->GetName());
        Settings::GetSingleton()->bIsNewGame = false;
        this->eventHandler.dispatch("PostLoadGame");
    }
    if (!event->opening && event->menuName == "Loading Menu")
        Scaleform::AchievementWidget::Show();
    return RE::BSEventNotifyControl::kContinue;
}

void EventProcessor::Register() {
    RE::UI::GetSingleton()->AddEventSink<RE::MenuOpenCloseEvent>(GetSingleton());
}
