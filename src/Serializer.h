#include "Achievement.h"
#include <fmt/core.h>
#include <filesystem>
#include <nlohmann/json.hpp>
#include "CommonFunctions.h"
#include "Singleton.h"

#ifndef SERIALIZER_H
#define SERIALIZER_H

#define DIRECTORY_PATH "Data/SKSE/Plugins/AchievementInjector/"
#define FILENAME "UnlockedAchievements_{}.json"

struct SerializedAchievement {
	std::string achievementName;
	bool unlocked;
	int64_t unlockDatetime;
	std::vector<bool> conditionsMet;
};

class Serializer : public ISingleton<Serializer> {
public:
	Serializer();
	void Save();
	void SerializeAchievementData(Achievement* achievement);
	struct SerializedAchievement DeserializeAchievementData(std::string name);
	void CreateFileIfNotExists();
private:
	std::string GetFilename() const;
	const std::string& path = "DATA/SKSE/Plugins/AchievementInjector/UnlockedAchievements_{}.json";
	json jsonData;
};

#endif