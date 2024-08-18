#include "Singleton.h"
#include <nlohmann/json.hpp>
#include "Achievement.h"

using json = nlohmann::json;

struct AchievementFile {
	std::string groupName;
	std::string plugin;
	std::string path;
	json FileData;
};

class AchievementGroup
{
public:
	std::string name;
	std::string plugin;
	std::vector<Achievement*> achievements;

	AchievementGroup(std::string name, std::string plugin) : name(name), plugin(plugin) {}
	void ToGFxValue(RE::GFxValue* gfxValue);
};

class AchievementManager : public ISingleton<AchievementManager> {
public:
	std::vector<AchievementFile> achievementFiles;
	std::vector<AchievementGroup> achievementGroups;
	std::string lastUsedPlayerName = "";
};