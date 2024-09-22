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

//Taken from https://github.com/powerof3/CLibUtil/blob/master/include/CLIBUtil/editorID.hpp
namespace clib_util::editorID {
    using _GetFormEditorID = const char* (*) (std::uint32_t);

    inline std::string get_editorID(RE::TESForm* a_form) {
        switch (a_form->GetFormType()) {
            case RE::FormType::Keyword:
            case RE::FormType::LocationRefType:  //this is a subclass of keyword
            case RE::FormType::Action:           //this is a subclass of keyword
                return static_cast<RE::BGSKeyword*>(a_form)
                    ->formEditorID
                    .c_str();  //For currently unknown reasons GetFormEditorID crashes the game when called on a Keyword with no editor id
                               //while this line does not
            case RE::FormType::
                Global:  //I do not know if the below object types will exhibt a similar crash but I've added the same fix to the object types used in this model just to be safe
                return static_cast<RE::TESGlobal*>(a_form)->formEditorID.c_str();
            case RE::FormType::Race:
                return static_cast<RE::TESRace*>(a_form)->formEditorID.c_str();
            case RE::FormType::WorldSpace:
                return static_cast<RE::TESWorldSpace*>(a_form)->editorID.c_str();
            case RE::FormType::Quest:
                return static_cast<RE::TESQuest*>(a_form)->formEditorID.c_str();
            case RE::FormType::MusicType:
                return static_cast<RE::BGSMusicType*>(a_form)->formEditorID.c_str();
            case RE::FormType::MenuIcon:
            case RE::FormType::HeadPart:
            case RE::FormType::Sound:
            case RE::FormType::Script:
            case RE::FormType::Navigation:
            case RE::FormType::Cell:
            case RE::FormType::Land:
            case RE::FormType::NavMesh:
            case RE::FormType::Dialogue:
            case RE::FormType::Idle:
            case RE::FormType::AnimatedObject:
            case RE::FormType::ImageAdapter:
            case RE::FormType::VoiceType:
            case RE::FormType::Ragdoll:
            case RE::FormType::DefaultObject:
            case RE::FormType::StoryManagerBranchNode:
            case RE::FormType::StoryManagerQuestNode:
            case RE::FormType::StoryManagerEventNode:
            case RE::FormType::SoundRecord:
                return a_form->GetFormEditorID();
            default: {
                static auto tweaks = GetModuleHandle("po3_Tweaks");
                static auto func = reinterpret_cast<_GetFormEditorID>(GetProcAddress(tweaks, "GetFormEditorID"));
                if (func) {
                    return func(a_form->formID);
                }
                return {};
            }
        }
    }
}  // namespace clib_util::editorID