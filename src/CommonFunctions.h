#pragma once
#include<nlohmann/json.hpp>

using json = nlohmann::json;


uint16_t CheckQuestStage(std::string FormID, std::string baseEsp);
RE::ActorValue StringToActorValue(std::string value);
std::string FormIDToString(RE::FormID formID);
void ReadJson(const std::string& filePath, json* jsonData);
RE::TESForm* GetForm(std::string FormID, std::string baseEsp);
bool BindPapyrusFunctions(RE::BSScript::IVirtualMachine* vm);