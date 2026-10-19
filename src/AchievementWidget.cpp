#include <chrono>
#include "AchievementWidget.h"
#include "settings.h"

#undef PlaySound

namespace Scaleform {
    AchievementWidget::AchievementWidget() {
        auto scaleformManager = RE::BSScaleformManager::GetSingleton();
        scaleformManager->LoadMovieEx(this, MENU_PATH, [this](RE::GFxMovieDef* a_def) {
            using StateType = RE::GFxState::StateType;

            fxDelegate.reset(new RE::FxDelegate());
            fxDelegate->RegisterHandler(this);
            a_def->SetState(StateType::kExternalInterface, fxDelegate.get());
            fxDelegate->Release();

            //auto logger = new Logger<AchievementWidget>();
            //a_def->SetState(StateType::kLog, logger);
            //logger->Release();
            });

        inputContext = Context::kNone;
        // Above HUD Menu (2), which hosts the SkyUI widgets
        depthPriority = 3;
        // kAlwaysOpen keeps QuickLoot IE from treating the widget as a blocking menu
        menuFlags.set(RE::UI_MENU_FLAGS::kAlwaysOpen, RE::UI_MENU_FLAGS::kAllowSaving, RE::UI_MENU_FLAGS::kCustomRendering,
            RE::UI_MENU_FLAGS::kAssignCursorToRenderer);
    }

    void AchievementWidget::Register() {
        auto ui = RE::UI::GetSingleton();
        if (ui) {
            ui->Register(AchievementWidget::MENU_NAME, Creator);
            logger::debug("Widget {} Registered.", AchievementWidget::MENU_NAME);
        }
    }

    void AchievementWidget::Show() {
        auto ui = RE::UI::GetSingleton();
        if (!ui || ui->IsMenuOpen(AchievementWidget::MENU_NAME)) {
            return;
        }
        auto uiMessageQueue = RE::UIMessageQueue::GetSingleton();
        if (uiMessageQueue) {
            uiMessageQueue->AddMessage(AchievementWidget::MENU_NAME, RE::UI_MESSAGE_TYPE::kShow, nullptr);
        }
    }

    void AchievementWidget::Hide() {
        auto uiMessageQueue = RE::UIMessageQueue::GetSingleton();
        if (uiMessageQueue) {
            uiMessageQueue->AddMessage(AchievementWidget::MENU_NAME, RE::UI_MESSAGE_TYPE::kHide, nullptr);
        }
    }

    void AchievementWidget::Accept(RE::FxDelegateHandler::CallbackProcessor* a_cbReg) {
        a_cbReg->Process("PlaySound", PlaySound);
    }

    void AchievementWidget::PlaySound(const RE::FxDelegateArgs& a_params) {
        assert(a_params.GetArgCount() == 1);
        assert(a_params[0].IsString());

        RE::PlaySound(a_params[0].GetString());
    }

    void AchievementWidget::DisplayEntry(std::string name, std::string description, std::string sound = "") {
        static int failures = 0;  // consecutive attempts that found no widget
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        auto menu = ui->GetMenu(AchievementWidget::MENU_NAME); 
        if (menu == nullptr || (menu != nullptr && (!menu->uiMovie || !menu->uiMovie->GetVisible()))) {
            AchievementWidget::Show();
            menu = ui->GetMenu(AchievementWidget::MENU_NAME);
        }
        // Maybe at some point understand why this is null with racemenu and skyrim unbound reborn
        if (menu != nullptr && menu->uiMovie && menu->uiMovie->GetVariable(&widget, "_root.AchievementWidget_mc")) {
            failures = 0;
            std::array<RE::GFxValue, 1> nameArgs;
            std::array<RE::GFxValue, 1> descriptionArgs;
            std::array<RE::GFxValue, 3> showArgs;
            std::array<RE::GFxValue, 1> posArgs;
            std::array<RE::GFxValue, 1> scaleArgs;
            nameArgs[0] = name;
            descriptionArgs[0] = description;
            
            posArgs[0] = 63.70 + Settings::GetSingleton()->GetWidgetYOffset();
            scaleArgs[0] = Settings::GetSingleton()->GetWidgetScale();
            widget.Invoke("setYPosition", nullptr, posArgs.data(), posArgs.size());
            widget.Invoke("setScale", nullptr, scaleArgs.data(), scaleArgs.size());

            showArgs[0] = true;
            showArgs[1] = !Settings::GetSingleton()->GetMute();
            showArgs[2] = Settings::GetSingleton()->GetNotificationSound();
            logger::debug("Invoking ActionScript with parameters ({}, {}) on AchievementWidget", name, description);
            widget.Invoke("setName", nullptr, nameArgs.data(), nameArgs.size());
            widget.Invoke("setDescription", nullptr, descriptionArgs.data(), descriptionArgs.size());
            widget.Invoke("ShowNotification", nullptr, showArgs.data(), showArgs.size());
            // logger::debug("Sound: {}, override: {}", sound, Settings::GetSingleton()->GetOverrideNotificationSound());
            if (!Settings::GetSingleton()->GetMute()) {
                if (sound != "" && !Settings::GetSingleton()->GetOverrideNotificationSound()) {
                    RE::PlaySound(sound.c_str());
                }
                else {
                    RE::PlaySound(Settings::GetSingleton()->GetNotificationSound().c_str());
                }
            }
            std::jthread t(HideEntry);
            t.detach();
        } else {
            // Widget not up yet (Show is async): queue it again instead of dropping the popup.
            // Capped at about a minute so a missing SWF does not retry for the whole session.
            if (++failures <= 15)
                DisplayEntryWithWait(std::make_tuple(name, description, sound));
            else
                logger::error("Achievement widget unavailable, dropping popup for {}.", name);
        }
    }

    void AchievementWidget::HideEntry() {
        std::this_thread::sleep_for(std::chrono::seconds(3));
        // Scaleform may only be touched from the UI thread
        SKSE::GetTaskInterface()->AddUITask([]() {
            auto ui = RE::UI::GetSingleton();
            if (!ui) return;
            RE::GFxValue widget;
            auto menu = ui->GetMenu(AchievementWidget::MENU_NAME);
            if (menu != nullptr && menu->uiMovie && menu->uiMovie->GetVariable(&widget, "_root.AchievementWidget_mc")) {
                std::array<RE::GFxValue, 2> hideArgs;
                hideArgs[0] = false;
                hideArgs[1] = false;
                widget.Invoke("ShowNotification", nullptr, hideArgs.data(), hideArgs.size());
            }
        });
    }
}