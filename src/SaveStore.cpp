#include "SaveStore.h"

#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

namespace SaveStore {
	// Entries come from a file users edit and older versions wrote: a missing or mistyped field must not throw
	static bool IsEntry(const json& entry, const std::string& name) {
		return entry.is_object() && entry.value("AchievementName", json()) == name;
	}

	static bool IsUnlocked(const json& entry) {
		return entry.is_object() && entry.value("Unlocked", json()) == true;
	}

	static bool HasEntries(const json& data) {
		return data.is_object() && data.contains("AchievementData") && data["AchievementData"].is_array();
	}

	json Empty() {
		return { {"SchemaVersion", 1}, {"AchievementData", json::array()} };
	}

	// Write to a temp file then rename, so a crash mid-write can't leave a truncated save
	bool Write(const std::string& path, const json& data) {
		const std::string text = data.dump(4, ' ', false, json::error_handler_t::replace);
		std::ofstream out(path + ".tmp");
		out << text;
		out.close();
		std::error_code ec;
		if (out) fs::rename(path + ".tmp", path, ec);
		if (out && !ec) return true;
		// Rename can be refused (locked target, virtual file systems): write in place rather than lose the save
		std::ofstream direct(path);
		direct << text;
		direct.close();
		return static_cast<bool>(direct);
	}

	// An unreadable file must not throw into the game: keep it as .bak and start empty
	bool Load(const std::string& path, json& data) {
		std::ifstream in(path);
		data = json::parse(in, nullptr, false);
		in.close();
		if (HasEntries(data)) return true;
		std::error_code ec;
		fs::copy_file(path, path + ".bak", fs::copy_options::overwrite_existing, ec);
		data = Empty();
		Write(path, data);
		return false;
	}

	SerializedAchievement Find(const json& data, const std::string& name) {
		if (HasEntries(data)) {
			for (const json& entry : data["AchievementData"]) {
				if (!IsEntry(entry, name)) continue;
				const json date = entry.value("UnlockDatetime", json());
				const json state = entry.value("ConditionsState", json());
				SerializedAchievement found{ name, IsUnlocked(entry), date.is_number_integer() ? date.get<int64_t>() : -1, {} };
				// A bad value keeps its slot as 0: conditions are matched by position
				if (state.is_array()) for (const json& value : state) found.conditionsState.push_back(value.is_number_integer() ? value.get<int>() : 0);
				return found;
			}
		}
		return { "NULL", false, -1, {} };
	}

	bool Put(json& data, const std::string& name, bool unlocked, int64_t unlockDatetime, const std::vector<int>& conditionsState) {
		if (!HasEntries(data)) data = Empty();
		auto& entries = data["AchievementData"].get_ref<json::array_t&>();
		for (const json& entry : entries) if (IsEntry(entry, name) && IsUnlocked(entry)) return false;
		std::erase_if(entries, [&name](const json& entry) { return IsEntry(entry, name); });
		entries.push_back({
			{"AchievementName", name},
			{"Unlocked", unlocked},
			{"UnlockDatetime", unlockDatetime},
			{"ConditionsState", conditionsState}
		});
		return true;
	}
}
