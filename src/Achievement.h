// Achievement.h
#include <string>
#include <vector>
#include <memory>
#include <nlohmann/json.hpp>
#include <eventpp/eventdispatcher.h>
#include "ConditionsJoinType.h"
#include "log.h"
#include "CommonFunctions.h"
#include "Conditions/Condition.h"
#include "Runnable.h"

#ifndef ACHIEVEMENT_H
#define ACHIEVEMENT_H

namespace logger = SKSE::log;

using json = nlohmann::json;

class Achievement : Runnable {
public:
    // Constructor that initializes the Achievement from a JSON object
    Achievement(json& jsonData, std::string plugin, std::string localizationPath);
    void EnableListener(void);
    void OnConditionMet(void);
    void OnSerializationRequested(void);
    std::vector<int> GetConditionsState(void);
    void ForceUnlock();
    void Localize();
    std::string ToString();

    eventpp::EventDispatcher<std::string, void()> eventHandler;
    std::string achievementName;
    std::string description;
    std::vector<Condition*> conditions;
    std::string plugin;
    std::string notificationSound = "";
    std::string groupName = "";
    std::string icon;
    std::string iconPath = "";  // menu-relative path, empty when the icon file is missing

    bool unlocked;
    bool showPopup = true;
    bool hidden = false;
    bool showInMenu = true;
    std::vector<bool> conditionMet;
private:
    ConditionsJoinType joinType;
};

#endif