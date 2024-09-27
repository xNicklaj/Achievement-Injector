#include "Serializer.h"
#include "settings.h"
#include <algorithm>


namespace fs = std::filesystem;
using json = nlohmann::json;

Serializer::Serializer() {

}
std::string Serializer::GetFilename() const {
	std::string fileName;

	// Get final configuration path
	if (!Settings::GetSingleton()->GetGlobal()) {
		// Get player name
		std::string playerName = RE::PlayerCharacter::GetSingleton()->GetName();
		std::transform(playerName.begin(), playerName.end(), playerName.begin(), [](unsigned char c) { return std::toupper(c); });
		fileName = fmt::format(FILENAME, playerName);
	}
	else fileName = fmt::format(FILENAME, "GLOBAL");
	std::string finalPath = DIRECTORY_PATH + fileName;
	return finalPath;
}

std::string Serializer::GetFilename(bool useGlobal) const {
	std::string fileName;

	// Get final configuration path
	if (!useGlobal) {
		// Get player name
		std::string playerName = RE::PlayerCharacter::GetSingleton()->GetName();
		std::transform(playerName.begin(), playerName.end(), playerName.begin(), [](unsigned char c) { return std::toupper(c); });
		playerName.erase(std::remove(playerName.begin(), playerName.end(), ' '), playerName.end());

		fileName = fmt::format(FILENAME, playerName);
	}
	else fileName = fmt::format(FILENAME, "GLOBAL");
	std::string finalPath = DIRECTORY_PATH + fileName;
	return finalPath;
}

void Serializer::SerializeAchievementData(Achievement* achievement) {
	SerializeAchievementData_GLOBAL(achievement);
	if (Settings::GetSingleton()->GetGlobal()) {
		return;
	}


	auto achievementData = jsonData["AchievementData"].get<std::vector<json>>();
	bool remove = false;
    for (const auto& entry : achievementData) {
        if (entry["AchievementName"] == achievement->achievementName) {
			remove = true;
            break;
        }
    }
	if (remove) {
		achievementData.erase(
			std::remove_if(achievementData.begin(), achievementData.end(),
				[&achievement](const json& entry) {
					return entry["AchievementName"] == achievement->achievementName;
				}),
			achievementData.end()
		);
		jsonData["AchievementData"] = achievementData;
	}
	// Get the current time as std::chrono::system_clock::time_point
	auto now = std::chrono::system_clock::now();
	auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
	if (!achievement->unlocked) now_ms = -1;

	this->jsonData["AchievementData"].push_back({
		{"AchievementName", achievement->achievementName},
		{"Unlocked", achievement->unlocked},
		{"UnlockDatetime", now_ms},
		{"ConditionsState", achievement->GetConditionsState()}
	});
	Save();
}

void Serializer::SerializeAchievementData_GLOBAL(Achievement* achievement) {
	auto achievementData = jsonData_GLOBAL["AchievementData"].get<std::vector<json>>();
	bool remove = false;
	for (const auto& entry : achievementData) {
		if (entry["AchievementName"] == achievement->achievementName) {
			if (entry["Unlocked"]) return;
			remove = true;
			break;
		}
	}
	if (remove) {
		achievementData.erase(
			std::remove_if(achievementData.begin(), achievementData.end(),
				[&achievement](const json& entry) {
					return entry["AchievementName"] == achievement->achievementName;
				}),
			achievementData.end()
		);
		jsonData_GLOBAL["AchievementData"] = achievementData;
	}
	// Get the current time as std::chrono::system_clock::time_point
	auto now = std::chrono::system_clock::now();
	auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
	if (!achievement->unlocked) now_ms = -1;

	this->jsonData_GLOBAL["AchievementData"].push_back({
		{"AchievementName", achievement->achievementName},
		{"Unlocked", achievement->unlocked},
		{"UnlockDatetime", now_ms},
		{"ConditionsState", achievement->GetConditionsState()}
		});
	Save_GLOBAL();
}

struct SerializedAchievement Serializer::DeserializeAchievementData(std::string name) {
	
	if (Settings::GetSingleton()->GetGlobal()) {
		return DeserializeAchievementData_GLOBAL(name);
	}
	else
		DeserializeAchievementData_GLOBAL(name);

	try {
        std::string filename = GetFilename(false);
        if (!std::filesystem::exists(filename)) {
            return SerializedAchievement("NULL", false, -1);
        }
		std::ifstream inFile(filename);
		inFile >> jsonData;
		inFile.close();
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	for (json& achievement : jsonData["AchievementData"]) {
		if (achievement["AchievementName"] == name) {
			return SerializedAchievement({
				achievement["AchievementName"],
				achievement["Unlocked"],
				achievement["UnlockDatetime"],
				achievement["ConditionsState"]
			});
		}
	}
	return SerializedAchievement("NULL", false, -1);
}

struct SerializedAchievement Serializer::DeserializeAchievementData_GLOBAL(std::string name) {
	try {
		std::ifstream inFile(GetFilename(true));
		inFile >> jsonData_GLOBAL;
		inFile.close();
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	for (json& achievement : jsonData_GLOBAL["AchievementData"]) {
		if (achievement["AchievementName"] == name) {
			return SerializedAchievement({
				achievement["AchievementName"],
				achievement["Unlocked"],
				achievement["UnlockDatetime"],
				achievement["ConditionsState"]
				});
		}
	}

	return SerializedAchievement("NULL", false, -1);
}

void Serializer::Save() {
	std::string filename = this->GetFilename(false);
	try {
		std::ofstream outFile(filename);
		outFile << jsonData.dump(4);
		outFile.close();
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}
void Serializer::Save_GLOBAL() {
	std::string filename = this->GetFilename(true);
	try {
		std::ofstream outFile(filename);
		outFile << jsonData_GLOBAL.dump(4);
		outFile.close();
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}

void Serializer::CreateFileIfNotExists() {
	std::string fileName = GetFilename(false);
	try {
		if (!fs::exists(DIRECTORY_PATH)) {
			fs::create_directories(DIRECTORY_PATH);
		}
		if (fs::exists(fileName)) return;
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	jsonData["SchemaVersion"] = 1;
	jsonData["AchievementData"] = json::array();
	this->Save();

	fileName = GetFilename(true);
	try {
		if (!fs::exists(DIRECTORY_PATH)) {
			fs::create_directories(DIRECTORY_PATH);
		}
		if (fs::exists(fileName)) return;
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	jsonData_GLOBAL["SchemaVersion"] = 1;
	jsonData_GLOBAL["AchievementData"] = json::array();


	
	this->Save_GLOBAL();
}