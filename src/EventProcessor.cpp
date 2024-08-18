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
        if (event->menuName == "Journal Menu") {
            RE::GFxValue menu;
            if (ui->GetMenu("Journal Menu")->uiMovie->GetVariable(&menu, "_root")) {
                std::array<RE::GFxValue, 2> args;
                args[0] = "Achievements";
                args[1] = "-8745";
                menu.Invoke("createEmptyMovieClip", args);
            }
            if (ui->GetMenu("Journal Menu")->uiMovie->GetVariable(&menu, "_root.Achievements")) {
                std::array<RE::GFxValue, 1> args;
                args[0] = "AchievementsMenuInjector.swf";
                menu.Invoke("loadMovie", args);
            }
        }
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