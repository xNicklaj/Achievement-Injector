#include "AchievementMenu.h"
#include "Scaleform.h"
#include "Utility.h"
#include "AchievementManager.h"

namespace Scaleform {
    AchievementMenu::AchievementMenu() {
        auto scaleformManager = RE::BSScaleformManager::GetSingleton();
        scaleformManager->LoadMovieEx(this, MENU_PATH, [this](RE::GFxMovieDef* a_def) {
            using StateType = RE::GFxState::StateType;

            fxDelegate.reset(new RE::FxDelegate());
            fxDelegate->RegisterHandler(this);
            a_def->SetState(StateType::kExternalInterface, fxDelegate.get());
            fxDelegate->Release();

            auto logger = new Logger<AchievementMenu>();
            a_def->SetState(StateType::kLog, logger);
            logger->Release();
            });

        inputContext = Context::kMenuMode;
        depthPriority = 3;
        menuFlags.set(RE::UI_MENU_FLAGS::kPausesGame, RE::UI_MENU_FLAGS::kDisablePauseMenu,
            RE::UI_MENU_FLAGS::kUsesBlurredBackground, RE::UI_MENU_FLAGS::kModal,
            RE::UI_MENU_FLAGS::kUsesMenuContext, RE::UI_MENU_FLAGS::kTopmostRenderedMenu,
            RE::UI_MENU_FLAGS::kUsesMovementToDirection);

        if (!RE::BSInputDeviceManager::GetSingleton()->IsGamepadEnabled()) {
            menuFlags |= RE::UI_MENU_FLAGS::kUsesCursor;
        }
    }

    void AchievementMenu::Register() {
        auto ui = RE::UI::GetSingleton();
        if (ui) {
            ui->Register(AchievementMenu::MENU_NAME, Creator);
            logger::debug("Registered {}", AchievementMenu::MENU_NAME);
        }
    }

    void AchievementMenu::Show() {
        auto uiMessageQueue = RE::UIMessageQueue::GetSingleton();
        if (uiMessageQueue) {
            uiMessageQueue->AddMessage(AchievementMenu::MENU_NAME, RE::UI_MESSAGE_TYPE::kShow, nullptr);
            RE::UIBlurManager::GetSingleton()->IncrementBlurCount();
        }
    }

    void AchievementMenu::Hide() {
        auto uiMessageQueue = RE::UIMessageQueue::GetSingleton();
        if (uiMessageQueue) {
            uiMessageQueue->AddMessage(AchievementMenu::MENU_NAME, RE::UI_MESSAGE_TYPE::kHide, nullptr);
            RE::PlaySound("UIJournalClose");
            RE::UIBlurManager::GetSingleton()->DecrementBlurCount();
        }
    }

    void AchievementMenu::Accept(RE::FxDelegateHandler::CallbackProcessor* a_cbReg) {
        a_cbReg->Process("PlaySound", PlaySound);
    }

    void AchievementMenu::PlaySound(const RE::FxDelegateArgs& a_params) {
        assert(a_params.GetArgCount() == 1);
        assert(a_params[0].IsString());

        RE::PlaySound(a_params[0].GetString());
    }

    void AchievementMenu::UpdateAchievementList() {
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        // Check if menu is found
        if (ui->GetMenu(AchievementMenu::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.AchievementMenu_mc")) {
            std::array<RE::GFxValue, 1> functionArgs;
            functionArgs[0] = RE::GFxValue(); // This will be an implicit array
            // Loop through all achievement groups and push them to the function arguments
            for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
                RE::GFxValue gfxAchievementGroup;
                achievementGroup.ToGFxValue(&gfxAchievementGroup);
                functionArgs[0].PushBack(&gfxAchievementGroup);
            }
            widget.Invoke("UpdateAchievementList", nullptr, functionArgs.data(), functionArgs.size());
        }
    }
}
