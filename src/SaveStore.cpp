#include "SaveStore.h"

#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

namespace SaveStore {
	// Entries come from a file users edit and older versions wrote: a missing or mistyped field must not throw
	// A null group matches the entries older versions wrote without one
	static bool IsEntry(const json& entry, const json& group, const std::string& name) {
		return entry.is_object() && entry.value("AchievementName", json()) == name && entry.value("Group", json()) == group;
	}

	static bool IsUnlocked(const json& entry) {
		return entry.is_object() && entry.value("Unlocked", json()) == true;
	}

	static bool HasEntries(const json& data) {
		return data.is_object() && data.contains("AchievementData") && data["AchievementData"].is_array();
	}

	static const json* FindEntry(const json& data, const json& group, const std::string& name) {
		if (HasEntries(data)) for (const json& entry : data["AchievementData"]) if (IsEntry(entry, group, name)) return &entry;
		return nullptr;
	}

	// Paths hold the character name as the game gives it, in UTF-8. A narrow string handed to std::filesystem is read
	// as the system code page and throws on bytes that are not valid in it (CTD with Chinese names).
	// An empty path is returned when nothing converts: opening it fails and the caller reports the write.
	static fs::path ToPath(const std::string& path) {
		try { return fs::path(std::u8string(path.begin(), path.end())); } catch (const std::exception&) {}
		try { return fs::path(path); } catch (const std::exception&) {}
		return {};
	}

	json Empty() {
		return { {"SchemaVersion", 1}, {"AchievementData", json::array()} };
	}

	bool Exists(const std::string& path) {
		const fs::path file = ToPath(path);
		std::error_code ec;
		if (fs::exists(file, ec)) return true;
		// Up to 1.1.1 the name was read as the system code page: adopt that file so non-ASCII names keep their progress
		try { fs::rename(fs::path(path), file, ec); } catch (const std::exception&) { return false; }
		return fs::exists(file, ec);
	}

	// Write to a temp file then rename, so a crash mid-write can't leave a truncated save
	bool Write(const std::string& path, const json& data) {
		const std::string text = data.dump(4, ' ', false, json::error_handler_t::replace);
		const fs::path file = ToPath(path), temp = ToPath(path + ".tmp");
		std::ofstream out(temp);
		out << text;
		out.close();
		std::error_code ec;
		if (out) fs::rename(temp, file, ec);
		if (out && !ec) return true;
		// Rename can be refused (locked target, virtual file systems): write in place rather than lose the save
		std::ofstream direct(file);
		direct << text;
		direct.close();
		return static_cast<bool>(direct);
	}

	// An unreadable file must not throw into the game: keep it as .bak and start empty
	bool Load(const std::string& path, json& data) {
		Exists(path);
		std::ifstream in(ToPath(path));
		data = json::parse(in, nullptr, false);
		in.close();
		if (HasEntries(data)) return true;
		std::error_code ec;
		fs::copy_file(ToPath(path), ToPath(path + ".bak"), fs::copy_options::overwrite_existing, ec);
		data = Empty();
		Write(path, data);
		return false;
	}

	SerializedAchievement Find(const json& data, const std::string& group, const std::string& name) {
		const json* entry = FindEntry(data, group, name);
		if (!entry) entry = FindEntry(data, json(), name);
		if (!entry) return { "NULL", false, -1, {} };
		const json date = entry->value("UnlockDatetime", json());
		const json state = entry->value("ConditionsState", json());
		SerializedAchievement found{ name, IsUnlocked(*entry), date.is_number_integer() ? date.get<int64_t>() : -1, {} };
		// A bad value keeps its slot as 0: conditions are matched by position
		if (state.is_array()) for (const json& value : state) found.conditionsState.push_back(value.is_number_integer() ? value.get<int>() : 0);
		return found;
	}

	bool Put(json& data, const std::string& group, const std::string& name, bool unlocked, int64_t unlockDatetime, const std::vector<int>& conditionsState) {
		if (!HasEntries(data)) data = Empty();
		if (Find(data, group, name).unlocked) return false;
		auto& entries = data["AchievementData"].get_ref<json::array_t&>();
		std::erase_if(entries, [&](const json& entry) { return IsEntry(entry, group, name); });
		entries.push_back({
			{"Group", group},
			{"AchievementName", name},
			{"Unlocked", unlocked},
			{"UnlockDatetime", unlockDatetime},
			{"ConditionsState", conditionsState}
		});
		return true;
	}
}
