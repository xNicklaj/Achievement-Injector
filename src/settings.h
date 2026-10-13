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

	bool GetDebug() const { return bDebug; }
	bool GetGlobal() const { return bGlobal; }
	bool GetUseDebugger() const { return bUseDebugger; }
	bool GetUsePopup() const { return bUsePopup; }
	bool GetMute() const { return bMute; }
	bool GetOverrideNotificationSound() const { return bOverrideNotificationSound; }
	bool GetShowHidden() const { return bShowHidden; }
	std::string GetNotificationSound() const { return sNotificationSound; }
    int GetWidgetYOffset() const { return iWidgetYOffset; }
    float GetWidgetScale() const { return fWidgetScale; }

	void PrintSettings() const {
		logger::debug("bDebug: {}, bGlobal: {}, bUseDebugger: {}, bUsePopup: {}, bMute: {}, bShowHidden: {}, iNotificationSound: {}", bDebug, bGlobal, bUseDebugger, bUsePopup, bMute, bShowHidden, sNotificationSound);
	}

	template <typename T>
	bool AssignValue(CSimpleIniA* ini, T* setting, std::string section, std::string key);


	const enum NotificationSound_e {
		UISkillIncreaseSD,
		UIQuestComplete,
		UISkillsForward,
		UIStartNewGame,
		UINewShoutLearned
	};



	bool bIsNewGame{ false };
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
	bool bShowHidden{ false };
	bool bOverrideNotificationSound{ false };
    float fWidgetScale{1.0f};
    int iWidgetYOffset{0};
	std::string sNotificationSound{ "UISkillIncreaseSD" };
};