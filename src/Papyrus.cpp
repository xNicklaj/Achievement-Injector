#include "Papyrus.h"
#include "settings.h"
#include "log.h"


namespace NativePapyrus {
	std::string OnPowerLearned(RE::StaticFunctionTag*) {
		return "Hello from C++!";
	}

	void OnConfigClose(RE::TESQuest*)
	{
		Settings::GetSingleton()->LoadSettings();
		SetupLog(false);
	}

	bool Register(RE::BSScript::IVirtualMachine* a_vm)
	{
		if (!a_vm) {
			return false;
		}

		a_vm->RegisterFunction("OnConfigClose", MCM, OnConfigClose);
		return true;
	}
}
