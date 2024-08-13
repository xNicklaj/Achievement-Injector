#include "Papyrus.h"
#include "settings.h"
#include "log.h"


namespace NativePapyrus {
	std::string OnPowerLearned(RE::StaticFunctionTag*) {
		return "Hello from C++!";
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

	bool Register(RE::BSScript::IVirtualMachine* a_vm)
	{
		if (!a_vm) {
			return false;
		}

		a_vm->RegisterFunction("OnConfigClose", MCM, OnConfigClose);
		a_vm->RegisterFunction("OnSettingChange", MCM, OnSettingChange);
		return true;
	}
}
