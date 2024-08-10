#include "Singleton.h"
#include <functional>
#include "log.h"
#include <SimpleIni.h>

#define MANAGER(T) T::Manager::GetSingleton()

#pragma once

class Settings : public ISingleton<Settings>
{
public:
	void LoadSettings() ;
	void LoadMCMSettings() const;

	void SerializeMCM(std::function<void(CSimpleIniA&)> a_func);

	bool GetDebug() const { return bDebug; }
	bool GetGlobal() const { return bGlobal; }
	bool GetUseDebugger() const { return bUseDebugger; }
	bool GetUsePopup() const { return bUsePopup; }
	bool GetMute() const { return bMute; }

	void SetDebug(bool a_val) { bDebug = a_val; }
	void SetGlobal(bool a_val) { bGlobal = a_val; }
	void SetUseDebugger(bool a_val) { bUseDebugger = a_val; }
	void SetUsePopup(bool a_val) { bUsePopup = a_val; }
	void SetMute(bool a_val) { bMute = a_val; }

	void PrintSettings() const {
		logger::debug("bDebug: {}, bGlobal: {}, bUseDebugger: {}, bUsePopup: {}, bMute: {}", bDebug, bGlobal, bUseDebugger, bUsePopup, bMute);
	}
private:
	static void SerializeINI(const wchar_t* a_path, std::function<void(CSimpleIniA&)> a_func, bool a_generate = false);
	static void SerializeINI(const wchar_t* a_defaultPath, const wchar_t* a_userPath, std::function<void(CSimpleIniA&)> a_func);

	// members
	const wchar_t* defaultMCMPath{ L"Data/MCM/Config/AchievementInjector/settings.ini" };
	const wchar_t* userMCMPath{ L"Data/MCM/Settings/AchievementInjector.ini" };

	bool bDebug{ false };
	bool bGlobal{ false };
	bool bUseDebugger{ false };
	bool bUsePopup{ true };
	bool bMute{ false };
};