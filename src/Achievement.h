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

#ifndef ACHIEVEMENT_H
#define ACHIEVEMENT_H

namespace logger = SKSE::log;

using json = nlohmann::json;

class Achievement {
public:
    // Constructor that initializes the Achievement from a JSON object
    Achievement(json& jsonData, std::string plugin);
    void EnableListener(void);
    void OnConditionMet(void);

    eventpp::EventDispatcher<std::string, void()> eventHandler;

    std::string achievementName;
    std::string description;
    std::vector<Condition*> conditions;
    std::string plugin;
    bool unlocked;
    bool hooked = false;
    std::vector<bool> conditionMet;
private:
    ConditionsJoinType joinType;
};

#endif