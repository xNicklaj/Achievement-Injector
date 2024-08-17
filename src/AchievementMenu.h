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

    class AchievementMenu : RE::IMenu {
    public:
        static constexpr const char* MENU_PATH = "achievementmenu";
        static constexpr const char* MENU_NAME = "AchievementMenu";

        AchievementMenu();

        static void Register();
        static void Show();
        static void Hide();
        static void UpdateAchievementList();

        static constexpr std::string_view Name();

        virtual void Accept(RE::FxDelegateHandler::CallbackProcessor* a_cbReg) override;

        static RE::stl::owner<RE::IMenu*> Creator() { return new AchievementMenu(); }

    private:
        static void PlaySound(const RE::FxDelegateArgs& a_params);
    };

    constexpr std::string_view AchievementMenu::Name() { return AchievementMenu::MENU_NAME; }

}

#endif  // BESTIARY_MENU_H
