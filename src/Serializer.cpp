#include "Serializer.h"


namespace fs = std::filesystem;
using json = nlohmann::json;

Serializer::Serializer() {
	try {
		if (!fs::exists(DIRECTORY_PATH)) {
			fs::create_directories(DIRECTORY_PATH);
			this->CreateFile();
		}
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}
std::string Serializer::GetFilename() const {
	std::string fileName;

	// Get final configuration path
	if (!this->isGlobal) {
		// Get player name
		std::string playerName = RE::PlayerCharacter::GetSingleton()->GetName();
		std::transform(playerName.begin(), playerName.end(), playerName.begin(), [](unsigned char c) { return std::toupper(c); });
		std::string fileName = fmt::format(FILENAME, playerName);
	}
	else std::string fileName = fmt::format(FILENAME, "GLOBAL");
	std::string finalPath = DIRECTORY_PATH + fileName;
	return finalPath;
}
void Serializer::SerializeAchievementData(Achievement* achievement) {
	if (achievement->unlocked) {
		// Get the current time as std::chrono::system_clock::time_point
		auto now = std::chrono::system_clock::now();
		auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

		this->jsonData["AchievementData"].push_back({
			{"AchievementName", achievement->achievementName},
			{"Unlocked", achievement->unlocked},
			{"UnlockDatetime", now_ms}
		});
	}
}

void Serializer::Save() {
	try {
		std::ofstream outFile(GetFilename());
		outFile << jsonData.dump(4);
		outFile.close();
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}

void Serializer::CreateFile() {
	std::string fileName;
	try {
		if (!fs::exists(DIRECTORY_PATH)) {
			fs::create_directories(DIRECTORY_PATH);
		}
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	jsonData["SchemaVersion"] = 1;
	jsonData["AchievementData"] = json::array();

	Save();
}