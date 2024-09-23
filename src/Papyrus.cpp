#include "Papyrus.h"
#include "settings.h"
#include "log.h"
#include "AchievementManager.h"

#undef PlaySound



namespace NativePapyrus {
#define BIND(a_method, ...) a_vm.RegisterFunction(#a_method##sv, script, a_method)
#define BIND_EVENT(a_method, ...) a_vm.RegisterFunction(#a_method##sv, script, a_method __VA_OPT__(, ) __VA_ARGS__)
#define STATIC_ARGS [[maybe_unused]] VM *a_vm, [[maybe_unused]] StackID a_stackID, RE::StaticFunctionTag *

    void UnlockAchievement(STATIC_ARGS, std::string name, std::string group) {
        logger::debug("UnlockAchievement called with parameters name: {}, group: {}", name, group);
        AchievementManager::GetSingleton()->ForceUnlock(name, group);
	}

	std::vector<int> GetVersion(STATIC_ARGS) {
        std::vector<int> response = std::vector<int>();
        response.push_back(1);
        response.push_back(1);
        response.push_back(0);

        return response;
    }

	void OnConfigClose(RE::TESQuest*)
	{
		//Settings::GetSingleton()->LoadSettings();
		//SetupLog(false);
	}

	void OnSettingChange(RE::TESQuest*, std::string a_id)
	{
		Settings::GetSingleton()->LoadSettings();
		SetupLog(false);
		if (a_id == "iNotificationSound:Sound") {
			RE::PlaySound(Settings::GetSingleton()->GetNotificationSound().c_str());
		}
	}

	bool Bind(VM& a_vm) {
        BIND(UnlockAchievement);
        BIND(GetVersion);
        logger::debug("Binding Papyrus Static functions...");
        return true;
    }

	bool Register(VM* a_vm)
	{
		if (!a_vm) {

			return false;
		}

		a_vm->RegisterFunction("OnConfigClose", MCM, OnConfigClose);
		a_vm->RegisterFunction("OnSettingChange", MCM, OnSettingChange);
        Bind(*a_vm);
		return true;
	}
}