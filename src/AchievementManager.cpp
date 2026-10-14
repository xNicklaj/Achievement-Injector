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

std::string AchievementGroup::ToString() {
    std::string ret = "", locked = "";
    for (const auto& achievement : this->achievements) {
        if (!achievement->showInMenu) continue;
        // Unlocked first, then locked, each keeping file order; a locked line carries -1 as its unlock time
        std::string line = achievement->ToString() + "\n";
        (line.find("||-1||") == std::string::npos ? ret : locked) += line;
    }
    return ret + locked;
}

void AchievementGroup::ForceUnlock(std::string achievementName) {
    for (const auto& achievement: this->achievements) {
        // Papyrus strings are case-insensitively interned, so the caller's casing may not survive
        if (_stricmp(achievement->achievementName.c_str(), achievementName.c_str()) == 0) {
            achievement->ForceUnlock();
            return;
        }
    }
}

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
    // Progress saves call this far more often than the menu opens: rebuild on demand in GetCache
    cacheDirty = true;
};

const std::string& AchievementManager::GetCache() {
    if (cacheDirty.exchange(false)) cache = this->ToString();
    return cache;
}

void AchievementManager::ForceUnlock(std::string achievementName, std::string group_a) {
    LocalizationManager* lm = LocalizationManager::GetSingleton();
    if (achievementName.starts_with("$")) {
        std::string prev = achievementName;
        achievementName = lm->GetLocalizedText(group_a, lm->CurrentLocale(), achievementName);
        logger::debug("Achievement {} was localized to {} to be unlocked.", prev, achievementName);
    }
    logger::debug("Forcing unlock of achievement {} in group {}.", achievementName, group_a);
    for (auto& group: this->achievementGroups) {
        if (_stricmp(group.groupid.c_str(), group_a.c_str()) == 0) {
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