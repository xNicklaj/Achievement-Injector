#include "AchievementManager.h"
#include "AchievementMenu.h"


AchievementGroup::AchievementGroup(std::string name, std::string plugin, std::string iconPath) : name(name), plugin(plugin), iconPath(iconPath) {
    if (name == "Skyrim")
        this->priority = 0;
    else if (name == "Dawnguard" || name == "Hearthfire" || name == "Dragonborn")
        this->priority = 1;
    else if (name == "The Sinister Seven")
        this->priority = 2;
    else
        this->priority = 3;
    this->showInMenu = true;
}

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
        if (!achievement->showInMenu)
            continue;
		data["AchievementData"].push_back(achievement->ToJson());
	}
    return data;
};

std::string AchievementGroup::ToString() {
    std::string ret = "";
    for (const auto& achievement : this->achievements) {
        ret += achievement->ToString() + "\n";
    }
    return ret;
}

void AchievementGroup::ForceUnlock(std::string achievementName) {
    for (const auto& achievement: this->achievements) {
        if (achievement->achievementName == achievementName) {
            achievement->ForceUnlock();
            return;
        }
    }
}

json AchievementManager::ToJson() {
    json data = json::array();

    std::sort(this->achievementGroups.begin(), this->achievementGroups.end(), [](const AchievementGroup& a, const AchievementGroup& b) {
        return a.priority < b.priority;
    });

    for(auto& achievementGroup : this->achievementGroups) {
        if(!achievementGroup.showInMenu || !CheckIfModIsLoaded(achievementGroup.plugin)) continue;
		data.push_back(achievementGroup.ToJson());
	}
    return data;
};

std::string AchievementManager::ToString() {
    std::string ret = "";
    int num_displayed = 0;
    // TODO: redo this shit

    std::sort(this->achievementGroups.begin(), this->achievementGroups.end(), [](const AchievementGroup& a, const AchievementGroup& b) {
        return a.priority < b.priority;
    });

    for (auto& achievementGroup: this->achievementGroups) {
        if (!achievementGroup.showInMenu || !CheckIfModIsLoaded(achievementGroup.plugin)) continue;
        num_displayed++;
    }
    ret += NumToString(num_displayed) + "\n";
    for (auto& achievementGroup: this->achievementGroups) {
        if (!achievementGroup.showInMenu || !CheckIfModIsLoaded(achievementGroup.plugin)) continue;
        ret += achievementGroup.groupid + "||" + achievementGroup.name + "||" + achievementGroup.iconPath + "\n";
    }
    for (auto& achievementGroup : this->achievementGroups) {
        if (!achievementGroup.showInMenu || !CheckIfModIsLoaded(achievementGroup.plugin)) continue;
        ret += achievementGroup.ToString();
    }
    return ret;
}

void AchievementManager::UpdateCache() {
    cache = AchievementManager::GetSingleton()->ToString();
};

void AchievementManager::ForceUnlock(std::string achievementName, std::string group_a) {
    LocalizationManager* lm = LocalizationManager::GetSingleton();
    if (achievementName.starts_with("$")) {
        std::string prev = achievementName;
        achievementName = lm->GetLocalizedText(group_a, lm->CurrentLocale(), achievementName);
        logger::debug("Achievement {} was localized to {} to be unlocked.", prev, achievementName);
    }
    logger::debug("Forcing unlock of achievement {} in group {}.", achievementName, group_a);
    for (auto& group: this->achievementGroups) {
        if (group.groupid == group_a) {
            group.ForceUnlock(achievementName);
            return;
        }
    }
}

void AchievementManager::AddEventSink(std::function<void(AchievementUnlockedEvent*)> callback) {
    this->eventHandler.appendListener("AchievementUnlocked", callback);
};

void AchievementManager::RemoveEventSink(std::function<void(AchievementUnlockedEvent*)> callback) {
   // TODO this->eventHandler.removeListener("AchievementUnlocked", callback);
}

void AchievementManager::Dispatch(AchievementUnlockedEvent* a_event) {
    this->eventHandler.dispatch("AchievementUnlocked", a_event);
};