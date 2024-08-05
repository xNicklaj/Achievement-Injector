#include "Achievement.h"
#include <fmt/core.h>
#include <filesystem>
#include <nlohmann/json.hpp>
#include "CommonFunctions.h"

#ifndef SERIALIZER_H
#define SERIALIZER_H

#define DIRECTORY_PATH "DATA/SKSE/Plugins/AchievementInjector/"
#define FILENAME "UnlockedAchievements_{}.json"

struct SerializedAchievement {
	std::string achievementName;
	bool unlocked;
	int64_t unlockDatetime;
};

class Serializer {
public:
	Serializer();
	void Save();
	void SerializeAchievementData(Achievement* achievement);
	Achievement* DeserializeAchievementData(std::string name);
	void SetGlobal(bool global) { isGlobal = global; }
private:
	void CreateFile();
	std::string GetFilename() const;
	const std::string& path = "DATA/SKSE/Plugins/AchievementInjector/UnlockedAchievements_{}.json";
	bool isGlobal = false;
	json jsonData;
};

#endif