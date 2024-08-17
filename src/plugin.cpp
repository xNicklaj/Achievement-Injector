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



void ReadAchievementFiles(std::vector<AchievementFile>* achievementFiles) {
	std::string directoryPath = "Data/AchievementsData";
	json tmp;

	try {
		if (fs::exists(directoryPath) && fs::is_directory(directoryPath)) {
			for (const auto& entry : fs::directory_iterator(directoryPath)) {
				if(fs::is_directory(entry.path().string())) continue;
				struct AchievementFile achievementFile;
				// Read JSON file
				ReadJson(entry.path().string(), &tmp);
				achievementFile.FileData = tmp["achievements"];
				achievementFile.groupName = tmp["groupName"];
				achievementFile.path = entry.path().filename().string();
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
			AchievementGroup ag(achievementFile.groupName, achievementFile.plugin);
			for (json achievement : achievementFile.FileData) {
				ag.achievements.push_back(new Achievement(achievement, ag.plugin, StripExtension(achievementFile.path)));
			}
			AchievementManager::GetSingleton()->achievementGroups.push_back(ag);
		}

		for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
			logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
		}
		EventProcessor::GetSingleton()->Register();
		Scaleform::AchievementWidget::Register();
		Scaleform::AchievementWidget::Show();

		Scaleform::AchievementMenu::Register();
		Scaleform::AchievementMenu::Show();
		break;
	case SKSE::MessagingInterface::kPostLoad:
		break;
	case SKSE::MessagingInterface::kPreLoadGame:
		break;
	case SKSE::MessagingInterface::kPostLoadGame:
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
        break;
	case SKSE::MessagingInterface::kNewGame:
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
	LocalizationManager::GetSingleton(); // Load localizations

    auto messaging = SKSE::GetMessagingInterface();
	if (!messaging->RegisterListener("SKSE", MessageHandler)) {
		return false;
	}

	if (Settings::GetSingleton()->GetUseDebugger()) {
		logger::debug("Waiting for debugger to attach...");
		while (!IsDebuggerPresent()) {
			::Sleep(1000);;
		};
		logger::debug("Debugger attached.");
	}

	SKSE::GetPapyrusInterface()->Register(NativePapyrus::Register);
	std::thread(ProcessQueue).detach();

	return true;
}