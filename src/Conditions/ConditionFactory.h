#pragma once

#include <string>
#include <nlohmann/json.hpp>
#include "Condition.h"

// Builds one condition from its JSON entry, with plugin, localization and onUnlock applied.
// Returns nullptr when the entry is unusable (unknown type, bad parameters, unsupported live/negate); the reason is logged.
Condition* CreateCondition(nlohmann::json& condition, const std::string& plugin, const std::string& groupName, const std::string& achievementName);
