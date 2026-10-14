#include "Achievement.h"
#include <filesystem>
#include <nlohmann/json.hpp>
#include "CommonFunctions.h"
#include "Singleton.h"
#include "SaveStore.h"

#ifndef SERIALIZER_H
#define SERIALIZER_H

#define DIRECTORY_PATH "Data/SKSE/Plugins/AchievementInjector/"
#define FILENAME "UnlockedAchievements_{}.json"

class Serializer : public ISingleton<Serializer> {
public:
	// Always writes the shared file, and the character's file too unless bGlobal is set
	void SerializeAchievementData(Achievement* achievement);
	// Reads from the file the current mode uses: the shared one with bGlobal, the character's otherwise
	struct SerializedAchievement DeserializeAchievementData(const std::string& group, const std::string& name);
	void CreateFileIfNotExists();
	// While deferred, saving only marks the file as pending; turning it off writes each pending file once
	void DeferSaves(bool defer);
private:
	// One progress file held in memory
	struct Store {
		bool global;
		json data;
		// File data was read from: it is only re-read when the path changes (character switch)
		std::string loadedPath;
		bool savePending = false;
	};
	Store character{ false };
	Store global{ true };
	bool deferSaves = false;

	std::string GetFilename(bool useGlobal) const;
	void Load(Store& store);
	void Save(Store& store);
	void Write(Store& store, Achievement* achievement);
};

#endif