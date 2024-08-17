#pragma once
#include<nlohmann/json.hpp>
#include <functional>
#include <queue>
#include <thread>
#include <mutex>
#include <map>
#include <fstream>
#include <condition_variable>

using json = nlohmann::json;


uint16_t CheckQuestStage(std::string FormID, std::string baseEsp);
RE::ActorValue StringToActorValue(std::string value);
std::string FormIDToString(RE::FormID formID);
void ReadJson(const std::string& filePath, json* jsonData);
template <typename T>
RE::TESForm* GetFormOfType(std::string FormID, std::string baseEsp);
RE::TESForm* GetForm(std::string FormID, std::string baseEsp);
bool BindPapyrusFunctions(RE::BSScript::IVirtualMachine* vm);
float GetGlobalVariableValue(RE::FormID formid);
std::string GetPlayerName();
bool isHex(const std::string& str);
std::string StripExtension(const std::string& filename);