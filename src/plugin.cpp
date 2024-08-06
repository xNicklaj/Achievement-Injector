#include "log.h"
#include "Serializer.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <functional>
#include "AchievementManager.h"

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
				struct AchievementFile achievementFile;
				// Read JSON file
				ReadJson(entry.path().string(), &tmp);
				achievementFile.FileData = tmp["achievements"];
				achievementFile.groupName = tmp["groupName"];
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
	AchievementManager::GetSingleton()->achievementFiles;

	switch (a_msg->type) {
	case SKSE::MessagingInterface::kDataLoaded:
		ReadAchievementFiles(&(AchievementManager::GetSingleton()->achievementFiles));
		for (auto& achievementFile : (AchievementManager::GetSingleton()->achievementFiles)) {
			AchievementGroup ag(achievementFile.groupName, achievementFile.plugin);
			for (json achievement : achievementFile.FileData) {
				ag.achievements.push_back(new Achievement(achievement, ag.plugin));
			}
			AchievementManager::GetSingleton()->achievementGroups.push_back(ag);
		}

		for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
			logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
		}
		break;
	case SKSE::MessagingInterface::kPostLoad:
		break;
	case SKSE::MessagingInterface::kPreLoadGame:
		break;
	case SKSE::MessagingInterface::kPostLoadGame:
		Serializer::GetSingleton()->CreateFile();

		for (auto& achievementGroup : AchievementManager::GetSingleton()->achievementGroups) {
			logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
			for (auto& achievement : achievementGroup.achievements) {
				achievement->EnableListener();
			}
		}


		logger::info("Data loaded. Executing {} functions.", postLoadConditionRegistry.size());
		for (auto& condition : postLoadConditionRegistry) {
			condition->OnDataLoaded();
		}
        break;
	case SKSE::MessagingInterface::kNewGame:
		break;
	}
}

SKSEPluginLoad(const SKSE::LoadInterface *skse) {
    SKSE::Init(skse);
	SetupLog();


    auto messaging = SKSE::GetMessagingInterface();
	if (!messaging->RegisterListener("SKSE", MessageHandler)) {
		return false;
	}

	
    return true;
}