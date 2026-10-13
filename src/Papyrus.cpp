#include "Papyrus.h"
#include "settings.h"
#include "log.h"
#include "AchievementManager.h"
#include "Utility.h"

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
        // The version is set once, in xmake.lua
        const auto version = SKSE::PluginDeclaration::GetSingleton()->GetVersion();
        return { static_cast<int>(version.major()), static_cast<int>(version.minor()), static_cast<int>(version.patch()) };
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
		else if (a_id == "iWidgetYOffset:Main" || a_id == "fWidgetScale:Main") {
			// TODO fix fire multiple times
            DisplayEntryWithWait(std::make_tuple("Test Notification", "This is a test notification.", ""));
        } else if (a_id == "bShowHidden:Main") {
            AchievementManager::GetSingleton()->UpdateCache();
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