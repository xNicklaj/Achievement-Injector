// Achievement.h
#include <string>
#include <vector>
#include <memory>
#include <nlohmann/json.hpp>
#include <eventpp/eventdispatcher.h>
#include "ConditionsJoinType.h"
#include "Condition.h"
#include "AchievementFile.h"
#include "log.h"
#include "CommonFunctions.h"

#ifndef ACHIEVEMENT_H
#define ACHIEVEMENT_H

namespace logger = SKSE::log;

using json = nlohmann::json;

class Achievement {
public:
    // Constructor that initializes the Achievement from a JSON object
    Achievement(json& jsonData);
    void EnableListener(void);
    void OnConditionMet(void);
    eventpp::EventDispatcher<std::string, void()> eventHandler;

    std::string achievementName;
    std::string description;
    std::vector<Condition*> conditions;
    bool unlocked;
private:
    std::vector<bool> conditionReached;
    ConditionsJoinType joinType;
};

#endif