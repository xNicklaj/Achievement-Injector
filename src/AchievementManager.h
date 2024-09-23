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
    void ForceUnlock(std::string achievementName);
	void SetShowInMenu(bool showInMenu_p) { this->showInMenu = showInMenu_p; }
	void ToGFxValue(RE::GFxValue* gfxValue);
    void SetId(std::string id) { groupid = id; }
	json ToJson();
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
	json cache;

	json ToJson();
	void UpdateCache();
	void AddEventSink(std::function<void(AchievementUnlockedEvent*)> callback);
	void RemoveEventSink(std::function<void(AchievementUnlockedEvent*)> callback);
    void ForceUnlock(std::string achievementName, std::string group);
	void Dispatch(AchievementUnlockedEvent*);
private:
	eventpp::EventDispatcher<std::string, void(AchievementUnlockedEvent*)> eventHandler;
};
#endif