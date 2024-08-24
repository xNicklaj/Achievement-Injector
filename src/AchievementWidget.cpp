#include <chrono>
#include "AchievementWidget.h"
#include "settings.h"

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
        depthPriority = 0;
        menuFlags.set(RE::UI_MENU_FLAGS::kAllowSaving, RE::UI_MENU_FLAGS::kCustomRendering,
            RE::UI_MENU_FLAGS::kAssignCursorToRenderer, RE::UI_MENU_FLAGS::kTopmostRenderedMenu);
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

    void AchievementWidget::SetPosition() {
        auto ui = RE::UI::GetSingleton();
        if (!ui || !ui->IsMenuOpen(AchievementWidget::MENU_NAME)) {
            logger::debug("Bestiary Widget not open, couldn't set position");
            return;
        }
        RE::GFxValue widget;
        std::array<RE::GFxValue, 2> posArgs;
        std::array<RE::GFxValue, 1> scaleArgs;
        //posArgs[0] = widgetX;
        //posArgs[1] = widgetY;
        //scaleArgs[0] = widgetScale;
        ui->GetMenu(AchievementWidget::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.BestiaryWidget_mc");
        widget.Invoke("setPosition", nullptr, posArgs.data(), posArgs.size());
        widget.Invoke("setScale", nullptr, scaleArgs.data(), scaleArgs.size());

        //logger::info("Set widget position to X {} and Y {}, scale to {}", widgetX, widgetY, widgetScale);
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
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        if (ui->GetMenu(AchievementWidget::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.AchievementWidget_mc")) {
            std::array<RE::GFxValue, 1> nameArgs;
            std::array<RE::GFxValue, 1> descriptionArgs;
            std::array<RE::GFxValue, 3> showArgs;
            nameArgs[0] = name;
            descriptionArgs[0] = description;
            showArgs[0] = true;
            showArgs[1] = !Settings::GetSingleton()->GetMute();
            showArgs[2] = Settings::GetSingleton()->GetNotificationSound();
           // logger::debug("Invoking ActionScript with parameters ({}, {})", name, description);
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
        }
    }

    void AchievementWidget::HideEntry() {
        std::this_thread::sleep_for(std::chrono::seconds(3));
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        if (ui->GetMenu(AchievementWidget::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.AchievementWidget_mc")) {
            std::array<RE::GFxValue, 2> hideArgs;
            hideArgs[0] = false;
            hideArgs[1] = false;
            widget.Invoke("ShowNotification", nullptr, hideArgs.data(), hideArgs.size());
        }
    }
}