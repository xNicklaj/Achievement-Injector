#include "Singleton.h"
#include <nlohmann/json.hpp>
#include "Achievement.h"

using json = nlohmann::json;

struct AchievementFile {
	std::string groupName;
	std::string plugin;
	std::string path;
	std::string iconPath;
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

	AchievementGroup(std::string name, std::string plugin) : name(name), plugin(plugin) {}
	AchievementGroup(std::string name, std::string plugin, std::string iconPath);
	void ToGFxValue(RE::GFxValue* gfxValue);
	json ToJson();
};

class AchievementManager : public ISingleton<AchievementManager> {
public:
	std::vector<AchievementFile> achievementFiles;
	std::vector<AchievementGroup> achievementGroups;
	std::string lastUsedPlayerName = "";

	json ToJson();
};