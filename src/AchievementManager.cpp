#include "AchievementManager.h"


void AchievementGroup::ToGFxValue(RE::GFxValue* gfxValue) {

    RE::GFxValue gfxName;
    gfxValue->SetMember("name", gfxName);

    RE::GFxValue gfxAchievements;
    for (const auto& achievement : this->achievements) {
        RE::GFxValue gfxAchievement;
        achievement->ToGFxValue(&gfxAchievement);
        gfxAchievements.PushBack(&gfxAchievement);
    }
    gfxValue->SetMember("achievements", gfxAchievements);
}