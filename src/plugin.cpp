using namespace SKSE;
using namespace SKSE::log;
using namespace SKSE::stl;

#include "Plugin.h"
#include "log.h"
#include "GameEventHandler.h"
#include "AchievementManager.h"
#include "UIManager.h"
#include "AchievementWidget.h"
#include "Conditions/Condition.h"
#include "EventProcessor.h"
#include "Papyrus.h"
#include "ConsoleUtilSSE.h"
#include "Sync.h"
#include "log.h"
#include "Serializer.h"
#include "CustomRE.h"
#include "settings.h"
#include "LocalizationManager.h"
#include "AchievementMenu.h"

using json = nlohmann::json;
using namespace SKSE;
using namespace SKSE::log;
using namespace SKSE::stl;
namespace fs = std::filesystem;

std::vector<Condition*> postLoadConditionRegistry;

void RegisterPostLoadFunction(Condition* condition) {
    postLoadConditionRegistry.push_back(condition);
}

void InitializePostLoad() {
    Serializer::GetSingleton()->CreateFileIfNotExists();

    if (GetPlayerName() != AchievementManager::GetSingleton()->lastUsedPlayerName) {
        AchievementManager::GetSingleton()->lastUsedPlayerName = GetPlayerName();

        for (auto& achievementGroup: AchievementManager::GetSingleton()->achievementGroups) {
            for (auto& achievement: achievementGroup.achievements) {
                achievement->EnableListener();
            }
        }

        logger::info("Data loaded. Executing {} functions.", postLoadConditionRegistry.size());
        for (auto& condition: postLoadConditionRegistry) {
            condition->OnDataLoaded();
        }
    }

    Scaleform::AchievementWidget::Show();
    AchievementManager::GetSingleton()->UpdateCache();
    Settings::GetSingleton()->bInitialized = true;
}

void ReadAchievementDirectory(std::vector<AchievementFile>* achievementFiles, std::string directoryPath) {
    json tmp;

    try {
        if (fs::exists(directoryPath) && fs::is_directory(directoryPath)) {
            for (const auto& entry: fs::directory_iterator(directoryPath)) {
                if (fs::is_directory(entry.path().string()))
                    continue;
                struct AchievementFile achievementFile;
                // Read JSON files
                try {
                    ReadJson(entry.path().string(), &tmp);
                } catch (const std::exception& e) {
                    logger::error("Error reading JSON file: {}", e.what());
                    logger::error("Skipping file {}.", entry.path().string());
                    continue;
                }
                achievementFile.useNewDirectory = entry.path().string().find("SKSE/Plugins/AchievementsData") != std::string::npos;
                achievementFile.FileData = tmp["achievements"];
                achievementFile.groupName = tmp["groupName"];
                achievementFile.showInMenu = tmp.value("showAchievements", true);
                achievementFile.path = entry.path().filename().string();
                std::string iconPath = StripExtension(entry.path().filename().string()) + ".dds";
                std::ifstream file("Data/AchievementsData/Icons/" + iconPath);
                if (file.good())
                    achievementFile.iconPath = "AchievementsData/Icons/" + iconPath;
                else {
                    std::ifstream file2("Data/SKSE/Plugins/AchievementsData/Icons/" + iconPath);
                    if (file2.good())
                        achievementFile.iconPath = "SKSE/Plugins/AchievementsData/Icons/" + iconPath;
                    else {
                        achievementFile.iconPath = "SKSE/Plugins/AchievementsData/Icons/Default.dds";
                    }
                }

                achievementFile.plugin = tmp["plugin"];
                (*achievementFiles).push_back(achievementFile);
            }
        } else {
            logger::warn("Path {} does not exist or is not a directory.", directoryPath);
        }
    } catch (const fs::filesystem_error& e) {
        logger::error("Filesystem error: {}", e.what());
    }
}

void ReadAchievementFiles(std::vector<AchievementFile>* achievementFiles) {
    std::string directoryPath = "Data/AchievementsData";
    ReadAchievementDirectory(achievementFiles, directoryPath);
    directoryPath = "Data/SKSE/Plugins/AchievementsData";
    ReadAchievementDirectory(achievementFiles, directoryPath);
}

void WaitForDebugger(void) {
    logger::debug("Waiting for debugger to attach...");
    while (!IsDebuggerPresent()) {
        ::Sleep(1000);
    };
    logger::debug("Debugger attached.");
}

void MessageHandler(SKSE::MessagingInterface::Message* a_msg) {
    switch (a_msg->type) {
        case SKSE::MessagingInterface::kDataLoaded:
            LocalizationManager::GetSingleton();  // Load localizations
            ReadAchievementFiles(&(AchievementManager::GetSingleton()->achievementFiles));
            for (auto& achievementFile: (AchievementManager::GetSingleton()->achievementFiles)) {
                AchievementGroup ag(achievementFile.groupName, achievementFile.plugin, achievementFile.iconPath);
                ag.SetShowInMenu(achievementFile.showInMenu);
                for (json achievement: achievementFile.FileData) {
                    ag.achievements.push_back(new Achievement(achievement, ag.plugin, StripExtension(achievementFile.path)));
                }
                AchievementManager::GetSingleton()->achievementGroups.push_back(ag);
            }

            for (auto& achievementGroup: AchievementManager::GetSingleton()->achievementGroups) {
                logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
            }
            EventProcessor::GetSingleton()->Register();
            //EventProcessor::GetSingleton()->EvaluateRequiredCellChanges();
            Scaleform::AchievementWidget::Register();
            Scaleform::AchievementMenuInjector::Register();
            Scaleform::AchievementMenu::Register();
            //Serializer::GetSingleton()->CreateFileIfNotExists();
            //AchievementManager::GetSingleton()->UpdateCache();
            EventProcessor::GetSingleton()->eventHandler.appendListener("PostLoadGame", InitializePostLoad);
            break;
        case SKSE::MessagingInterface::kPostLoad:
            break;
        case SKSE::MessagingInterface::kPreLoadGame:
            break;
        case SKSE::MessagingInterface::kPostLoadGame:
            EventProcessor::GetSingleton()->eventHandler.dispatch("PostLoadGame");
            break;
        case SKSE::MessagingInterface::kNewGame:
            Settings::GetSingleton()->bIsNewGame = true;
            break;
        case SKSE::MessagingInterface::kSaveGame:
            Scaleform::AchievementWidget::Show();
            break;
    }
}

extern "C" DLLEXPORT bool SKSEAPI SKSEPlugin_Load(const LoadInterface* skse) {
    //WaitForDebugger();
    Init(skse);
    SetupLog(true);
    Settings::GetSingleton()->LoadSettings();
    SetupLog();
    Settings::GetSingleton()->PrintSettings();
    

    if (Settings::GetSingleton()->GetUseDebugger())
        WaitForDebugger();

    const auto messaging = SKSE::GetMessagingInterface();
    messaging->RegisterListener("SKSE", MessageHandler);

    SKSE::GetPapyrusInterface()->Register(NativePapyrus::Register);
    std::thread(ProcessQueue).detach();

    return true;
}