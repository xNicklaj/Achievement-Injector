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

struct AchievementGroupScaleformObject {
	std::string name;
	std::string iconPath;
	std::vector<ScaleformAchievementObject> achievements;
};

class AchievementGroup
{
public:
	std::string name;
	std::string plugin;
	std::vector<Achievement*> achievements;

	AchievementGroupScaleformObject GetScaleformObject();
	AchievementGroup(std::string name, std::string plugin) : name(name), plugin(plugin) {}
};

class AchievementManager : public ISingleton<AchievementManager> {
public:
	std::vector<AchievementFile> achievementFiles;
	std::vector<AchievementGroup> achievementGroups;
	std::string lastUsedPlayerName = "";
};