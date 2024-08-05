#include "log.h"
#include "AchievementFile.h"
#include "AchievementGroup.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <functional>

using json = nlohmann::json;
namespace fs = std::filesystem;

std::vector<Condition*> postLoadConditionRegistry;

void RegisterPostLoadFunction(Condition* condition) {
	postLoadConditionRegistry.push_back(condition);
}



void ReadAchievementFiles(std::vector<AchievementFile>* achievementFiles) {
	std::string directoryPath = "Data/AchievementsData";

	try {
		if (fs::exists(directoryPath) && fs::is_directory(directoryPath)) {
			for (const auto& entry : fs::directory_iterator(directoryPath)) {
				struct AchievementFile achievementFile;
				// Read JSON file
				achievementFile.FileName = entry.path().filename().string();
				ReadJson(entry.path().string(), &achievementFile.FileData);
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
	switch (a_msg->type) {
	case SKSE::MessagingInterface::kDataLoaded:
		break;
	case SKSE::MessagingInterface::kPostLoad:
		break;
	case SKSE::MessagingInterface::kPreLoadGame:
		break;
	case SKSE::MessagingInterface::kPostLoadGame:
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

	std::vector<AchievementFile> achievementFiles;
	std::vector<AchievementGroup> achievementGroups;

	ReadAchievementFiles(&achievementFiles);
	for (auto& achievementFile : (achievementFiles)) {
		AchievementGroup ag(achievementFile.FileName);
		for (json achievement : achievementFile.FileData) {
			ag.achievements.push_back(new Achievement(achievement));
		}
		achievementGroups.push_back(ag);
	}

	for (auto& achievementGroup : achievementGroups) {
		logger::debug("Achievement group {} has {} achievements", achievementGroup.name, achievementGroup.achievements.size());
		for (auto& achievement : achievementGroup.achievements) {
			achievement->EnableListener();
		}
	}

	
    return true;
}