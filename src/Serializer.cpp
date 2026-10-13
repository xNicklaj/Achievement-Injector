#include "Serializer.h"
#include "settings.h"
#include <algorithm>


namespace fs = std::filesystem;
using json = nlohmann::json;

// Write to a temp file then rename, so a crash mid-write can't leave a truncated save
static void WriteJson(const std::string& path, const json& data) {
	const std::string text = data.dump(4, ' ', false, json::error_handler_t::replace);
	std::ofstream out(path + ".tmp");
	out << text;
	out.close();
	std::error_code ec;
	if (out) fs::rename(path + ".tmp", path, ec);
	if (out && !ec) return;
	// Rename can be refused (locked target, virtual file systems): write in place rather than lose the save
	std::ofstream direct(path);
	direct << text;
	direct.close();
	if (!direct) logger::error("Failed to write {}.", path);
}

// An unreadable file must not throw into the game: keep it as .bak and start empty
static void LoadJson(const std::string& path, json& out) {
	std::ifstream in(path);
	out = json::parse(in, nullptr, false);
	in.close();
	if (out.is_object() && out.contains("AchievementData") && out["AchievementData"].is_array()) return;
	logger::error("{} is missing or unreadable, starting empty (previous copy kept as .bak).", path);
	std::error_code ec;
	fs::copy_file(path, path + ".bak", fs::copy_options::overwrite_existing, ec);
	out = { {"SchemaVersion", 1}, {"AchievementData", json::array()} };
	WriteJson(path, out);
}

// Entries come from a file users edit and older versions wrote: a missing or mistyped field must not throw
static bool IsEntry(const json& entry, const std::string& name) {
	return entry.is_object() && entry.value("AchievementName", json()) == name;
}

static bool IsUnlocked(const json& entry) {
	return entry.is_object() && entry.value("Unlocked", json()) == true;
}

static bool ReadEntry(const json& entry, const std::string& name, SerializedAchievement& out) {
	if (!IsEntry(entry, name)) return false;
	const json date = entry.value("UnlockDatetime", json());
	const json state = entry.value("ConditionsState", json());
	out = { name, IsUnlocked(entry), date.is_number_integer() ? date.get<int64_t>() : -1, {} };
	// A bad value keeps its slot as 0: conditions are matched by position
	if (state.is_array()) for (const json& value : state) out.conditionsState.push_back(value.is_number_integer() ? value.get<int>() : 0);
	return true;
}

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
		// Characters Windows refuses in a file name would leave this character without a save file
		for (char& c : playerName) if (static_cast<unsigned char>(c) < 32 || std::string_view("<>:\"/\\|?*").find(c) != std::string_view::npos) c = '_';

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
        if (IsEntry(entry, achievement->achievementName)) {
			// Keep the first unlock date: other conditions of an OR achievement still ask for saves after it unlocked
			if (IsUnlocked(entry)) return;
			remove = true;
            break;
        }
    }
	if (remove) {
		achievementData.erase(
			std::remove_if(achievementData.begin(), achievementData.end(),
				[&achievement](const json& entry) {
					return IsEntry(entry, achievement->achievementName);
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
		if (IsEntry(entry, achievement->achievementName)) {
			if (IsUnlocked(entry)) return;
			remove = true;
			break;
		}
	}
	if (remove) {
		achievementData.erase(
			std::remove_if(achievementData.begin(), achievementData.end(),
				[&achievement](const json& entry) {
					return IsEntry(entry, achievement->achievementName);
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
        if (filename != loadedPath) {
            if (!std::filesystem::exists(filename)) {
                return SerializedAchievement("NULL", false, -1);
            }
            LoadJson(filename, jsonData);
            loadedPath = filename;
        }
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	for (const json& entry : jsonData["AchievementData"]) {
		SerializedAchievement found;
		if (ReadEntry(entry, name, found)) return found;
	}
	return SerializedAchievement("NULL", false, -1);
}

struct SerializedAchievement Serializer::DeserializeAchievementData_GLOBAL(std::string name) {
	try {
		std::string filename = GetFilename(true);
		if (filename != loadedPath_GLOBAL) {
			LoadJson(filename, jsonData_GLOBAL);
			loadedPath_GLOBAL = filename;
		}
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
	for (const json& entry : jsonData_GLOBAL["AchievementData"]) {
		SerializedAchievement found;
		if (ReadEntry(entry, name, found)) return found;
	}

	return SerializedAchievement("NULL", false, -1);
}

void Serializer::DeferSaves(bool defer) {
	deferSaves = defer;
	if (defer) return;
	if (savePending) Save();
	if (savePending_GLOBAL) Save_GLOBAL();
	savePending = savePending_GLOBAL = false;
}

void Serializer::Save() {
	if (deferSaves) { savePending = true; return; }
	std::string filename = this->GetFilename(false);
	try {
		WriteJson(filename, jsonData);
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}
void Serializer::Save_GLOBAL() {
	if (deferSaves) { savePending_GLOBAL = true; return; }
	std::string filename = this->GetFilename(true);
	try {
		WriteJson(filename, jsonData_GLOBAL);
	}
	catch (const fs::filesystem_error& e) {
		logger::error("Filesystem error: {}", e.what());
	}
}

void Serializer::CreateFileIfNotExists() {
	std::error_code ec;
	fs::create_directories(DIRECTORY_PATH, ec);
	// The two files are independent: one existing must not skip creating the other
	if (!fs::exists(GetFilename(false), ec)) {
		jsonData = { {"SchemaVersion", 1}, {"AchievementData", json::array()} };
		this->Save();
	}
	if (!fs::exists(GetFilename(true), ec)) {
		jsonData_GLOBAL = { {"SchemaVersion", 1}, {"AchievementData", json::array()} };
		this->Save_GLOBAL();
	}
}
