#include "PCH.h"
#include "RE/Skyrim.h"
#include "RE/G/GFxMovieDef.h"
#include "RE/G/GFxValue.h"
#include "RE/G/GPtr.h"
#include "SKSE/SKSE.h"
#include "Utility.h"

namespace Scaleform {

    class AchievementWidget : RE::IMenu {
    public:
        static constexpr const char* MENU_PATH = "achievementwidget";
        static constexpr const char* MENU_NAME = "AchievementWidget";

        AchievementWidget();

        static void Register();
        static void Show();
        static void Hide();
        static void DisplayEntry(std::string, std::string, std::string);
        static void HideEntry();
        static void SetPosition();

        static constexpr std::string_view Name();

        virtual void Accept(RE::FxDelegateHandler::CallbackProcessor* a_cbReg) override;

        static RE::stl::owner<RE::IMenu*> Creator() { return new AchievementWidget(); }

    private:
        static void PlaySound(const RE::FxDelegateArgs& a_params);
    };

    constexpr std::string_view AchievementWidget::Name() { return AchievementWidget::MENU_NAME; }

}