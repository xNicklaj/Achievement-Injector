#include "Singleton.h"
#include <nlohmann/json.hpp>
#include <eventpp/eventdispatcher.h>
#include "Achievement.h"

#ifndef ACHIEVEMENTMANAGER_H
#define ACHIEVEMENTMANAGER_H

using json = nlohmann::json;

struct AchievementFile {
	std::string groupName;
	std::string plugin;
	std::string path;
	std::string iconPath;
	bool useNewDirectory = false;
	bool showInMenu = true;
	json FileData;
};

class AchievementGroup
{
public:
	std::string name;
	std::string plugin;
    std::string groupid;
	std::vector<Achievement*> achievements;
	std::string iconPath = "";
	short priority;
	bool showInMenu;

	AchievementGroup(std::string name, std::string plugin, std::string iconPath);
	void SetShowInMenu(bool showInMenu_p) { this->showInMenu = showInMenu_p; }
    void SetId(std::string id) { groupid = id; }
    std::string ToString();
};

struct AchievementUnlockedEvent {
	Achievement* achievement;
	std::string achievementGroup;
};


class AchievementManager : public ISingleton<AchievementManager> {
public:
	std::vector<AchievementFile> achievementFiles;
	std::vector<AchievementGroup> achievementGroups;
	std::string lastUsedPlayerName = "";
	const std::string& GetCache();

    std::string ToString();
	void UpdateCache();
	void AddEventSink(std::function<void(AchievementUnlockedEvent*)> callback);
	void RemoveEventSink(std::function<void(AchievementUnlockedEvent*)> callback);
    void ForceUnlock(std::string achievementName, std::string group);
	// Case-insensitive; a "$key" name is localized first. Null if the group or achievement doesn't exist
	Achievement* Find(std::string achievementName, const std::string& group);
	bool IsUnlocked(const std::string& achievementName, const std::string& group);
	// True while load-time condition checks run, so listeners can tell old unlocks from live ones
	bool retroactive = false;
	void Dispatch(AchievementUnlockedEvent*);
private:
	std::string cache;
	std::atomic<bool> cacheDirty = true;
	eventpp::EventDispatcher<std::string, void(AchievementUnlockedEvent*)> eventHandler;
};
#endif