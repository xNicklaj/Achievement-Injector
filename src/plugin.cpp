#include <nlohmann/json.hpp>
#include <filesystem>
#include <functional>
#include <Windows.h>

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
namespace fs = std::filesystem;

std::vector<Condition*> postLoadConditionRegistry;

void RegisterPostLoadFunction(Condition* condition) {
	postLoadConditionRegistry.push_back(condition);
}

void InitializePostLoad() {
	Serializer::GetSingleton()->CreateFileIfNotExists();

	if (GetPlayerName() != AchievementManager::GetSingleton()->lastUsedPlayerName) {
		AchievementManager::GetSingleton()->lastUsedPlayerName = GetPlayerName();

		for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
			for (auto& achievement : achievementGroup.achievements) {
				achievement->EnableListener();
			}
		}

		logger::info("Data loaded. Executing {} functions.", postLoadConditionRegistry.size());
		for (auto& condition : postLoadConditionRegistry) {
			condition->OnDataLoaded();
		}
	}

	Scaleform::AchievementWidget::Show();
	AchievementManager::GetSingleton()->UpdateCache();
	Settings::GetSingleton()->bInitialized = true;
}

void ReadAchievementFiles(std::vector<AchievementFile>* achievementFiles) {
	std::string directoryPath = "Data/AchievementsData";
	json tmp;

	try {
		if (fs::exists(directoryPath) && fs::is_directory(directoryPath)) {
			for (const auto& entry : fs::directory_iterator(directoryPath)) {
				if(fs::is_directory(entry.path().string())) continue;
				struct AchievementFile achievementFile;
				// Read JSON files
				try {
					ReadJson(entry.path().string(), &tmp);
				}
				catch (const std::exception& e) {
					logger::error("Error reading JSON file: {}", e.what());
					logger::error("Skipping file.");
					continue;
				}
				achievementFile.FileData = tmp["achievements"];
				achievementFile.groupName = tmp["groupName"];
				achievementFile.showInMenu = tmp.value("showAchievements", true);
				achievementFile.path = entry.path().filename().string();
				std::string iconPath = StripExtension(entry.path().filename().string()) + ".dds";
				std::ifstream file("Data/AchievementsData/Icons/"+iconPath);
				if(file.good())
					achievementFile.iconPath = iconPath;
				else
					achievementFile.iconPath = "Default.dds";
				achievementFile.plugin = tmp["plugin"];
				(*achievementFiles).push_back(achievementFile);
			}
		}
		else {
			logger::error("Path does not exist or is not a directory."); 
		}
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}

void OnDataLoaded()
{
   
}

void MessageHandler(SKSE::MessagingInterface::Message* a_msg)
{
	auto eventProcessor = EventProcessor::GetSingleton();
	int test = -1;
	switch (a_msg->type) {
	case SKSE::MessagingInterface::kDataLoaded:
		ReadAchievementFiles(&(AchievementManager::GetSingleton()->achievementFiles));
		for (auto& achievementFile : (AchievementManager::GetSingleton()->achievementFiles)) {
			AchievementGroup ag(achievementFile.groupName, achievementFile.plugin, achievementFile.iconPath);
			ag.SetShowInMenu(achievementFile.showInMenu);
			for (json achievement : achievementFile.FileData) {
				ag.achievements.push_back(new Achievement(achievement, ag.plugin, StripExtension(achievementFile.path)));
			}
			AchievementManager::GetSingleton()->achievementGroups.push_back(ag);
		}

		for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
			logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
		}
		EventProcessor::GetSingleton()->Register();
		EventProcessor::GetSingleton()->EvaluateRequiredCellChanges();
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

SKSEPluginLoad(const SKSE::LoadInterface *skse) {
    SKSE::Init(skse);
	Settings::GetSingleton()->LoadSettings();
	SetupLog();
	Settings::GetSingleton()->PrintSettings();
	LocalizationManager::GetSingleton(); // Load localizations

    auto messaging = SKSE::GetMessagingInterface();
	if (!messaging->RegisterListener("SKSE", MessageHandler)) {
		return false;
	}

	if (Settings::GetSingleton()->GetUseDebugger()) {
		logger::debug("Waiting for debugger to attach...");
		while (!IsDebuggerPresent()) {
			::Sleep(1000);
		};
		logger::debug("Debugger attached.");
	}
	

	SKSE::GetPapyrusInterface()->Register(NativePapyrus::Register);
	std::thread(ProcessQueue).detach();

	return true;
}