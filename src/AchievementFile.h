#pragma once

#include <nlohmann/json.hpp>

using json = nlohmann::json;

struct AchievementFile {
    std::string FileName;
    json FileData;
};