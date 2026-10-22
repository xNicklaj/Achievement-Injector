#include "Achievement.h"

#include <algorithm>
#include <string>
#include <memory>
#include "ConditionsJoinType.h"
#include "CommonFunctions.h"
#include "settings.h"
#include "Serializer.h"
#include "Utility.h"
#include <fmt/core.h>
#include "AchievementWidget.h"
#include "../include/ConsoleUtilSSE.h"
#include "LocalizationManager.h"

#include "Conditions/ConditionFactory.h"
#include "AchievementManager.h"

static bool checkIcon(std::string group, std::string name) {
    if (name == "")
        return false;
    if (!std::filesystem::exists("Data\\SKSE\\Plugins\\AchievementsData\\Icons\\" + group + "\\" + name)) {
        logger::warn("Icon {} from {} was declared but doesn't exist at path", name, group, "Data\\SKSE\\Plugins\\AchievementsData\\Icons\\" + group + "\\");
        return false;
    }
    return true;
}

Achievement::Achievement(json& jsonData, std::string plugin, std::string groupName)
    : Runnable(jsonData.value("onUnlock", json::array())), achievementName(jsonData["achievementName"].get<std::string>()),
    description(jsonData["description"].get<std::string>()),
    unlocked(false) {  // Initialize joinType and unlocked

    this->groupName = groupName;
    // Group plugin, optionally overridden here; conditions inherit this unless they override it too
    this->plugin = jsonData.value("pluginOverride", plugin);
    if (jsonData.value("joinType", "OR") == "OR") this->joinType = ConditionsJoinType::OR;
    else this->joinType = ConditionsJoinType::AND;
    
    this->showPopup = jsonData.value("showPopup", true);
    this->showInMenu = jsonData.value("showInMenu", true);
    this->hidden = jsonData.value("hideDescription", false);
    this->notificationSound = jsonData.value("notificationSound", "");
    this->icon = jsonData.value("icon", "");
    // Resolved once: the menu list is rebuilt often and must not hit the disk per achievement
    if (checkIcon(groupName, this->icon)) this->iconPath = "..\\SKSE\\Plugins\\AchievementsData\\Icons\\" + groupName + "\\" + this->icon;

    this->eventHandler.appendListener("ConditionMet", [this]() {
        this->OnConditionMet();
    });
    this->eventHandler.appendListener("SerializationRequested", [this]() {
        this->OnSerializationRequested();
    });

    this->Localize();
    logger::debug("Analyzing achievement {}.", this->achievementName);

    for (json& condition : jsonData["conditions"]) {
        Condition* a_condition = CreateCondition(condition, this->plugin, this->groupName, this->achievementName);
        if (!a_condition) continue;
        conditions.push_back(a_condition);
        conditionMet.push_back(false);
    }
    if (!conditions.empty() && std::all_of(conditions.begin(), conditions.end(), [](Condition* c) { return c->live; }))
        logger::warn("Achievement {} has only live conditions and can never unlock.", this->achievementName);
}

void Achievement::ForceUnlock() {
    for (Condition* condition: conditions) {
        condition->isMet = true;
    }
    this->eventHandler.dispatch("ConditionMet");
}

void Achievement::EnableListener(void) {
    if(conditions.size() == 0) {
		logger::warn("Achievement {} has no conditions.", this->achievementName);
	}
    // Runs again on a character switch: drop the previous character's in-memory progress
    this->unlocked = false;
    conditionMet.assign(conditionMet.size(), false);
    static const std::vector<int> noState;
    for (Condition* condition : conditions) {
        condition->Deserialize(0);
        condition->isMet = false;
        condition->LoadChildren(noState, 0); // clears sub-conditions
    }
    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->groupName, this->achievementName);
    if (sa.unlocked) {
        this->unlocked = true;
        logger::info("Achievement {} has already been unlocked.", this->achievementName);
        // Sinks hooked for a previous character may still be registered; mark them spent
        for (Condition* condition : conditions) condition->isMet = true;
        return;
    }

    size_t childOffset = conditions.size();
    for (Condition* condition : conditions) childOffset = condition->LoadChildren(sa.conditionsState, childOffset);

    for (size_t i = 0; i < conditions.size(); i++) {
        Condition* condition = conditions[i];
        if (condition->live) continue; // evaluated on demand in OnConditionMet, nothing to hook
        if (!CheckIfModIsLoaded(condition->plugin)) {
            logger::warn("Plugin {} not loaded. Skipping condition.", condition->plugin);
            continue;
        }
        if (i < sa.conditionsState.size() && condition->Deserialize(sa.conditionsState[i])) {
            // Already fulfilled: nothing to listen for, but the other conditions still need hooking
            condition->isMet = true;
            this->conditionMet[i] = true;
            continue;
        };
        condition->SetEventManager(&eventHandler);
		condition->EnableListener();
	}
}

void Achievement::OnSerializationRequested() {
    logger::info("Serialization requested.");
    Serializer::GetSingleton()->SerializeAchievementData(this);
    AchievementManager::GetSingleton()->UpdateCache();
}

void Achievement::OnConditionMet(void) {
    if (this->unlocked) return;
    bool allConditionsMet = false;
    int i = 0;
    for (Condition* condition : conditions) {
        if (condition->live) {
            // isMet is only true here via ForceUnlock
            conditionMet[i] = condition->isMet || (condition->Evaluate() != condition->negate);
        } else if (condition->isMet == true) {
            conditionMet[i] = true;
        }
        i++;
    }

    switch (this->joinType) {
    case ConditionsJoinType::OR:
        allConditionsMet = false;
        for (bool condition : conditionMet) {
            if (condition == true) {
                allConditionsMet = true;
                break;
            }
        }
		break;
    case ConditionsJoinType::AND:
        allConditionsMet = true;
        for (bool condition : conditionMet) {
            if (condition == false) {
                allConditionsMet = false;
                break;
            }
        }
        break;
    }

    // A live condition that fails means this firing doesn't count: don't latch the others, or they could never re-trigger the check
    if (!allConditionsMet && std::any_of(conditions.begin(), conditions.end(), [](Condition* c) { return c->live; })) {
        for (size_t j = 0; j < conditions.size(); j++) {
            if (conditions[j]->live) continue;
            conditions[j]->isMet = false;
            conditionMet[j] = false;
        }
    }

    // Zero conditions: only ForceUnlock dispatches here
    if (allConditionsMet || conditions.empty()) {
        unlocked = true;
        logger::info("Achievement {} unlocked", achievementName);
        AchievementUnlockedEvent e;
        e.achievement = this;
        e.achievementGroup = this->groupName;
        AchievementManager::GetSingleton()->Dispatch(&e);
        if (this->showPopup && Settings::GetSingleton()->GetUsePopup()) {
            DisplayEntryWithWait(std::make_tuple(this->achievementName, this->description, this->notificationSound));
        }
        this->RunAll();

    }
    this->eventHandler.dispatch("SerializationRequested");
    //Serializer::GetSingleton()->SerializeAchievementData(this);
}

std::vector<int> Achievement::GetConditionsState(void) {
    std::vector<int> v;
    for (Condition* condition : this->conditions) {
        v.push_back(condition->Serialize());
    }
    // Sub-conditions of composite conditions follow the top-level entries
    for (Condition* condition : this->conditions) condition->SerializeChildren(v);
    return v;
}

void Achievement::Localize() {
    if (achievementName[0] == '$') 
        this->achievementName = LocalizationManager::GetSingleton()->GetLocalizedText(this->groupName, LocalizationManager::GetSingleton()->CurrentLocale(), achievementName);
    if (description[0] == '$') 
        this->description = LocalizationManager::GetSingleton()->GetLocalizedText(this->groupName, LocalizationManager::GetSingleton()->CurrentLocale(), description);
}

std::string Achievement::ToString() {
    std::string output = "";

    std::string desc = this->description;
    if (!this->unlocked && this->hidden && !Settings::GetSingleton()->GetShowHidden()) {
        desc = "$ACH_HIDDEN";
        // The menu shows this text untranslated; desc keeps the key if the lookup fails
        SKSE::Translation::Translate("$ACH_HIDDEN", desc);
    }

    // TODO convert \n to something else

    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->groupName, this->achievementName);
    output =
        this->groupName + "||" + this->achievementName + "||" + replaceAll(desc, "\n", " ") + "||" +
        std::to_string(sa.unlocked ? sa.unlockDatetime : -1) + "||" + this->iconPath;
    return output;
}