#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

// Reading, changing and writing one progress file. No game types in here, so tests/SaveStoreTest.cpp
// builds it without Skyrim.

struct SerializedAchievement {
	std::string achievementName;
	bool unlocked;
	int64_t unlockDatetime;
	std::vector<int> conditionsState;
};

namespace SaveStore {
	using json = nlohmann::json;

	json Empty();

	// False when the file could not be written
	bool Write(const std::string& path, const json& data);

	// False when the file was missing or unreadable: it is kept as .bak, data starts empty and is written back
	bool Load(const std::string& path, json& data);

	// The entry stored for name, or {"NULL", false, -1} when there is none
	SerializedAchievement Find(const json& data, const std::string& name);

	// Stores the entry for name, replacing the previous one.
	// False, changing nothing, when name is already stored as unlocked: the first unlock date is kept.
	bool Put(json& data, const std::string& name, bool unlocked, int64_t unlockDatetime, const std::vector<int>& conditionsState);
}
