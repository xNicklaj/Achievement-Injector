#include "AchievementManager.h"
#include "AchievementMenu.h"


void AchievementGroup::ToGFxValue(RE::GFxValue* gfxValue) {

    RE::GFxValue gfxName;
    gfxName = this->name;
    gfxValue->SetMember("name", gfxName);
    RE::GFxValue gfxPath;
    gfxPath = "";
    gfxValue->SetMember("iconPath", gfxPath);

    RE::GFxValue gfxAchievements;
    RE::UI::GetSingleton()->GetMovieView(Scaleform::AchievementMenu::MENU_NAME)->CreateArray(&gfxAchievements);
    for (const auto& achievement : this->achievements) {
        RE::GFxValue gfxAchievement;
        RE::UI::GetSingleton()->GetMovieView(Scaleform::AchievementMenu::MENU_NAME)->CreateObject(&gfxAchievement);

        achievement->ToGFxValue(&gfxAchievement);
        gfxAchievements.PushBack(&gfxAchievement);
    }
    gfxValue->SetMember("achievements", gfxAchievements);
}

json AchievementGroup::ToJson() {
    json data = json::object();
    data["groupName"] = this->name;
    data["image"] = this->iconPath;
    data["AchievementData"];
    for (const auto& achievement : this->achievements) {
		data["AchievementData"].push_back(achievement->ToJson());
	}
    return data;
};

json AchievementManager::ToJson() {
    json data = json::array();
    for(auto& achievementGroup : this->achievementGroups) {
		data.push_back(achievementGroup.ToJson());
	}
    return data;
};