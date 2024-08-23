#include "AchievementMenu.h"
#include "Scaleform.h"
#include "Utility.h"
#include "AchievementManager.h"
#include "SKSE/SKSE.h"

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
        RE::UIBlurManager::GetSingleton()->blurCount = 0;
        menuFlags.set(RE::UI_MENU_FLAGS::kPausesGame, RE::UI_MENU_FLAGS::kDisablePauseMenu,
             RE::UI_MENU_FLAGS::kModal,
            RE::UI_MENU_FLAGS::kUsesMenuContext, RE::UI_MENU_FLAGS::kTopmostRenderedMenu,
            RE::UI_MENU_FLAGS::kUsesMovementToDirection);

        if (!RE::BSInputDeviceManager::GetSingleton()->IsGamepadEnabled()) {
            menuFlags |= RE::UI_MENU_FLAGS::kUsesCursor;
        }
    }

    void AchievementMenu::Register() {
        auto ui = RE::UI::GetSingleton();
        static AchievementMenu singleton;

        auto eventSource = SKSE::GetModCallbackEventSource();

        if (!eventSource) {
            logger::error("EventSource not found!");
            return;
        }

        if (ui) {
            ui->Register(AchievementMenu::MENU_NAME, Creator);
            logger::debug("Registered {}", AchievementMenu::MENU_NAME);
            eventSource->AddEventSink(&singleton);
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
            RE::UIBlurManager::GetSingleton()->DecrementBlurCount();
        }
    }

    void AchievementMenu::UpdateAchievementList() {
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        // Check if menu is found
        if (ui->GetMenu(AchievementMenu::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.MenuFader_mc")) {
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

    void AchievementMenu::UpdateAchievementList(std::string data) {
        auto ui = RE::UI::GetSingleton();
        RE::GFxValue widget;
        // Check if menu is found
        if (ui->GetMenu(AchievementMenu::MENU_NAME) == nullptr) {
            logger::debug("{} not found.", AchievementMenu::MENU_NAME);
            return;
        }
        if (ui->GetMenu(AchievementMenu::MENU_NAME)->uiMovie->GetVariable(&widget, "_root.MenuFader_mc")) {
            logger::debug("2");
            std::array<RE::GFxValue, 1> args;
            args[0] = data;
            widget.Invoke("setData", nullptr, args.data(), args.size());
        }
    }

    RE::BSEventNotifyControl AchievementMenu::ProcessEvent(const SKSE::ModCallbackEvent* a_event, RE::BSTEventSource<SKSE::ModCallbackEvent>* a_eventSource) {
        RE::UI* ui = RE::UI::GetSingleton();
        RE::GFxValue menu;
        if (a_event->eventName == "AchievementMenu_Init") {
            logger::debug("Init");
        }
        else if (a_event->eventName == "AchievementMenu_Close") {
            AchievementMenu::Hide();
        }
        return RE::BSEventNotifyControl::kContinue;
    }

    void AchievementMenuInjector::Inject() {
        RE::GFxValue menu;
        auto ui = RE::UI::GetSingleton();
        if (ui->GetMenu("Journal Menu")->uiMovie->GetVariable(&menu, "_root")) {
            std::array<RE::GFxValue, 2> args;
            args[0] = "Achievements";
            args[1] = "-8745";
            menu.Invoke("createEmptyMovieClip", nullptr, args.data(), args.size());
        }
        if (ui->GetMenu("Journal Menu")->uiMovie->GetVariable(&menu, "_root.Achievements")) {
            std::array<RE::GFxValue, 1> args;
            args[0] = "AchievementsMenuInjector.swf";
            menu.Invoke("loadMovie", nullptr, args.data(), args.size());
        }
    }

    RE::BSEventNotifyControl AchievementMenuInjector::ProcessEvent(const SKSE::ModCallbackEvent* a_event, RE::BSTEventSource<SKSE::ModCallbackEvent>* a_eventSource) {
        RE::UI* ui = RE::UI::GetSingleton();
        RE::GFxValue menu;
        if (a_event->eventName == "AchievementsMenu_Open") {
            if (ui->GetMenu("HUD Menu")->uiMovie->GetVariable(&menu, "_global.skse")) {
                std::array<RE::GFxValue, 1> args;
                args[0] = "Journal Menu";
                menu.Invoke("CloseMenu", args);
            }

            std::string filePath = "Data/SampleGroups.json";
            std::ifstream fileStream(filePath);
            if (!fileStream.is_open()) {
                throw std::runtime_error("Could not open file: " + filePath);
            }

            AchievementMenu::Show();
            std::stringstream buffer;
            buffer << fileStream.rdbuf();
            AchievementMenu::UpdateAchievementList(buffer.str());
            
        }
        return RE::BSEventNotifyControl::kContinue;
    }

    void AchievementMenuInjector::Register() {
        static AchievementMenuInjector singleton;

        auto eventSource = SKSE::GetModCallbackEventSource();

        if (!eventSource) {
            logger::error("EventSource not found!");
            return;
        }
        eventSource->AddEventSink(&singleton);
        logger::info("Register {}", typeid(singleton).name());
        return;
	}
}
