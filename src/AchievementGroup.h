#pragma once

#include "Achievement.h"

struct AchievementGroup
{
	std::string name;
	std::vector<Achievement*> achievements;

	AchievementGroup(std::string name) : name(name) {}
};