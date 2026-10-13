// Self-check for the progress file logic. Build and run with: xmake build SaveStoreTest && xmake run SaveStoreTest
#include "SaveStore.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>

namespace fs = std::filesystem;
using json = nlohmann::json;

static int failures = 0;

#define CHECK(condition) \
	if (!(condition)) { std::cout << "FAILED line " << __LINE__ << ": " #condition << std::endl; failures++; }

static std::string ReadText(const fs::path& path) {
	std::ifstream in(path);
	std::stringstream text;
	text << in.rdbuf();
	return text.str();
}

int main() {
	const fs::path dir = fs::temp_directory_path() / "AchievementInjectorSaveStoreTest";
	fs::remove_all(dir);
	fs::create_directories(dir);
	const std::string path = (dir / "UnlockedAchievements_TEST.json").string();

	// A missing file starts empty and is created
	json data;
	CHECK(!SaveStore::Load(path, data));
	CHECK(data == SaveStore::Empty());
	CHECK(fs::exists(path));

	// What is written comes back the same
	CHECK(SaveStore::Put(data, "Kills", false, -1, { 2, 0 }));
	CHECK(SaveStore::Put(data, "Hero", true, 100, { 1 }));
	CHECK(SaveStore::Write(path, data));
	json reloaded;
	CHECK(SaveStore::Load(path, reloaded));
	CHECK(reloaded == data);
	SerializedAchievement kills = SaveStore::Find(reloaded, "Kills");
	CHECK(kills.achievementName == "Kills" && !kills.unlocked && kills.unlockDatetime == -1);
	CHECK((kills.conditionsState == std::vector<int>{ 2, 0 }));
	CHECK(SaveStore::Find(reloaded, "Nobody").achievementName == "NULL");
	CHECK(!SaveStore::Find(reloaded, "Nobody").unlocked);

	// Progress replaces the old entry instead of adding a second one
	CHECK(SaveStore::Put(data, "Kills", false, -1, { 3, 0 }));
	CHECK(data["AchievementData"].size() == 2);
	CHECK((SaveStore::Find(data, "Kills").conditionsState == std::vector<int>{ 3, 0 }));

	// An unlocked entry keeps its first unlock date
	CHECK(!SaveStore::Put(data, "Hero", true, 200, { 1 }));
	CHECK(SaveStore::Find(data, "Hero").unlockDatetime == 100);
	CHECK(data["AchievementData"].size() == 2);

	// Entries with missing or mistyped fields read as defaults and never throw
	const json damaged = json::parse(R"({"AchievementData": [
		42,
		{"AchievementName": "NoFields"},
		{"AchievementName": "BadTypes", "Unlocked": "yes", "UnlockDatetime": "today", "ConditionsState": [1, "x", 3]},
		{"AchievementName": "Fine", "Unlocked": true, "UnlockDatetime": 5, "ConditionsState": []}
	]})");
	SerializedAchievement noFields = SaveStore::Find(damaged, "NoFields");
	CHECK(noFields.achievementName == "NoFields" && !noFields.unlocked && noFields.unlockDatetime == -1 && noFields.conditionsState.empty());
	SerializedAchievement badTypes = SaveStore::Find(damaged, "BadTypes");
	CHECK(!badTypes.unlocked && badTypes.unlockDatetime == -1);
	CHECK((badTypes.conditionsState == std::vector<int>{ 1, 0, 3 }));
	CHECK(SaveStore::Find(damaged, "Fine").unlocked && SaveStore::Find(damaged, "Fine").unlockDatetime == 5);
	CHECK(SaveStore::Find(json(), "Fine").achievementName == "NULL");
	json wrongShape = json::array();
	CHECK(SaveStore::Put(wrongShape, "Hero", true, 7, {}));
	CHECK(SaveStore::Find(wrongShape, "Hero").unlockDatetime == 7);

	// A broken file is kept as .bak and replaced by an empty, readable one
	const std::string broken = "{ \"AchievementData\": [ { \"AchievementName\": ";
	{ std::ofstream out(path); out << broken; }
	json recovered;
	CHECK(!SaveStore::Load(path, recovered));
	CHECK(recovered == SaveStore::Empty());
	CHECK(ReadText(path + ".bak") == broken);
	json afterRecovery;
	CHECK(SaveStore::Load(path, afterRecovery));
	CHECK(afterRecovery == SaveStore::Empty());

	// A file that parses but has the wrong shape is treated the same way
	{ std::ofstream out(path); out << "[1, 2, 3]"; }
	CHECK(!SaveStore::Load(path, recovered));
	CHECK(recovered == SaveStore::Empty());

	// A UTF-8 name that is not valid in the system code page neither throws nor loses the file
	const std::u8string dirUtf8 = dir.u8string();
	const std::string chinese = std::string(dirUtf8.begin(), dirUtf8.end()) + "/UnlockedAchievements_\xE9\xBE\x99\xE8\xA3\x94.json";
	CHECK(!SaveStore::Exists(chinese));
	CHECK(SaveStore::Write(chinese, data));
	CHECK(SaveStore::Exists(chinese));
	CHECK(fs::exists(dir / L"UnlockedAchievements_\x9F99\x88D4.json"));
	CHECK(SaveStore::Load(chinese, reloaded));
	CHECK(reloaded == data);

	fs::remove_all(dir);
	std::cout << (failures == 0 ? "SaveStoreTest passed" : "SaveStoreTest FAILED") << std::endl;
	return failures == 0 ? 0 : 1;
}
