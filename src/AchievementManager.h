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
	bool showInMenu;
	json FileData;
};

class AchievementGroup
{
public:
	std::string name;
	std::string plugin;
	std::vector<Achievement*> achievements;
	std::string iconPath = "";
	short priority;
	bool showInMenu;

	AchievementGroup(std::string name, std::string plugin, std::string iconPath);
	void SetShowInMenu(bool showInMenu) { this->showInMenu = showInMenu; }
	void ToGFxValue(RE::GFxValue* gfxValue);
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
	void Dispatch(AchievementUnlockedEvent*);
private:
	eventpp::EventDispatcher<std::string, void(AchievementUnlockedEvent*)> eventHandler;
};
#endif