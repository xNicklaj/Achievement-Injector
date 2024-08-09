#include "Singleton.h"
#include <functional>
#include <SimpleIni.h>

#define MANAGER(T) T::Manager::GetSingleton()

#pragma once

class Settings : public ISingleton<Settings>
{
public:
	void LoadSettings() const;
	void LoadMCMSettings() const;

	void SerializeMCM(std::function<void(CSimpleIniA&)> a_func);

	bool GetDebug() const { return bDebug; }
	bool GetGlobal() const { return bGlobal; }
private:
	static void SerializeINI(const wchar_t* a_path, std::function<void(CSimpleIniA&)> a_func, bool a_generate = false);
	static void SerializeINI(const wchar_t* a_defaultPath, const wchar_t* a_userPath, std::function<void(CSimpleIniA&)> a_func);

	// members
	const wchar_t* defaultMCMPath{ L"Data/MCM/Config/AchievementInjector/settings.ini" };
	const wchar_t* userMCMPath{ L"Data/MCM/Settings/AchievementInjector.ini" };

	bool bDebug { false };
	bool bGlobal { false };
};