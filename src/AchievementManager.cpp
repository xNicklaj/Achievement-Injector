#include "AchievementManager.h"

AchievementGroupScaleformObject AchievementGroup::GetScaleformObject() {
	std::vector<ScaleformAchievementObject> achievements;
	for (Achievement* achievement : this->achievements) {
		achievements.push_back(achievement->GetScaleformObject());
	}
	return AchievementGroupScaleformObject{name, "", achievements};
}