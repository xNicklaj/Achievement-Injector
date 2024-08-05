#pragma once
#include<nlohmann/json.hpp>

using json = nlohmann::json;

const RE::GFxValue SYSTEMMENU_ALIAS = "$ACHIEVEMENTS MENU";

uint16_t CheckQuestStage(std::string FormID, std::string baseEsp);
RE::ActorValue StringToActorValue(std::string value);
std::string FormIDToString(RE::FormID formID);
void AddMenuOption();
void ReadJson(const std::string& filePath, json* jsonData);