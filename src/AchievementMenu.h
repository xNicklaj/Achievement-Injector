#ifndef BESTIARY_MENU_H
#define BESTIARY_MENU_H

#include "PCH.h"
#include "RE/Skyrim.h"
#include "RE/G/GFxMovieDef.h"
#include "RE/G/GFxValue.h"
#include "RE/G/GPtr.h"
#include "SKSE/SKSE.h"
#include "Utility.h"

namespace Scaleform {

    class AchievementMenu : RE::IMenu, public RE::BSTEventSink<SKSE::ModCallbackEvent> {
    public:
        static constexpr const char* MENU_PATH = "achievementmenu";
        static constexpr const char* MENU_NAME = "AchievementMenu";

        AchievementMenu();

        static void Register();
        static void Show();
        static void Hide();
        static void UpdateAchievementList();
        static void UpdateAchievementList(std::string data);

        virtual RE::BSEventNotifyControl ProcessEvent(const SKSE::ModCallbackEvent* a_event, RE::BSTEventSource<SKSE::ModCallbackEvent>* a_eventSource);

        static constexpr std::string_view Name();

        static RE::stl::owner<RE::IMenu*> Creator() { return new AchievementMenu(); }
    };

    constexpr std::string_view AchievementMenu::Name() { return AchievementMenu::MENU_NAME; }

    class AchievementMenuInjector : RE::IMenu, public RE::BSTEventSink<SKSE::ModCallbackEvent> {
    public:
        static constexpr const char* MENU_PATH = "AchievementMenuInjector";
        static constexpr const char* MENU_NAME = "AchievementMenuInjector";

        static void Inject();

        virtual RE::BSEventNotifyControl ProcessEvent(const SKSE::ModCallbackEvent* a_event, RE::BSTEventSource<SKSE::ModCallbackEvent>* a_eventSource);
    
        static RE::stl::owner<RE::IMenu*> Creator() { return new AchievementMenuInjector(); }

        static void Register();

        static constexpr std::string_view Name();
    };

    constexpr std::string_view AchievementMenuInjector::Name() { return AchievementMenuInjector::MENU_NAME; }

}

#endif  // BESTIARY_MENU_H
