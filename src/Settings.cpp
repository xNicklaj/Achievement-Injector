#include "settings.h"
#include "log.h"
#include "AchievementManager.h"

void Settings::SerializeINI(const wchar_t* a_path, const std::function<void(CSimpleIniA&)> a_func, bool a_generate)
{
	CSimpleIniA ini;
	ini.SetUnicode();

	if (const auto rc = ini.LoadFile(a_path); !a_generate && rc < SI_OK) {
		logger::error("Failed to load ini file.");
		return;
	}

	a_func(ini);

	(void)ini.SaveFile(a_path);
}

void Settings::SerializeINI(const wchar_t* a_defaultPath, const wchar_t* a_userPath, std::function<void(CSimpleIniA&)> a_func)
{
	SerializeINI(a_defaultPath, a_func);
	SerializeINI(a_userPath, a_func);
}

void Settings::LoadSettings()
{
	LoadMCMSettings();
	logger::info("Settings loaded.");
	PrintSettings();
}

void Settings::LoadMCMSettings() const
{
	constexpr auto load_mcm = [](auto& ini) {
		Settings::GetSingleton()->bDebug = ini.GetBoolValue("Main", "bDebug");
		Settings::GetSingleton()->bUseDebugger = ini.GetBoolValue("Main", "bUseDebugger");
		bool tmpGlobal = ini.GetBoolValue("Main", "bGlobal");
		if (tmpGlobal != Settings::GetSingleton()->bGlobal)
		{
			Settings::GetSingleton()->bGlobal = tmpGlobal;
			AchievementManager::GetSingleton()->UpdateCache();
		}
		Settings::GetSingleton()->bUsePopup = ini.GetBoolValue("Main", "bUsePopup");
		Settings::GetSingleton()->bOverrideNotificationSound = ini.GetBoolValue("Sound", "bOverrideNotificationSound");

		Settings::GetSingleton()->bShowHidden = ini.GetBoolValue("Main", "bShowHidden");
		logger::debug("Set ShowHidden to {}", Settings::GetSingleton()->GetShowHidden());

		Settings::GetSingleton()->bMute = ini.GetBoolValue("Sound", "bMute");
		switch (ini.GetLongValue("Sound", "iNotificationSound"))
		{
		case NotificationSound_e::UINewShoutLearned:
				Settings::GetSingleton()->sNotificationSound = "UINewShoutLearned";
				break;
		case NotificationSound_e::UIQuestComplete:
				Settings::GetSingleton()->sNotificationSound = "UIQuestComplete";
				break;
		case NotificationSound_e::UISkillsForward:
			Settings::GetSingleton()->sNotificationSound = "UISkillsForward";
			break;
		case NotificationSound_e::UIStartNewGame:
			Settings::GetSingleton()->sNotificationSound = "UIStartNewGame";
			break;
		case NotificationSound_e::UISkillIncreaseSD:
		default:
			Settings::GetSingleton()->sNotificationSound = "UISkillIncreaseSD";
			break;
		}
	};
	SerializeINI(defaultMCMPath, userMCMPath, load_mcm);
}

void Settings::SerializeMCM(std::function<void(CSimpleIniA&)> a_func)
{
	SerializeINI(defaultMCMPath, a_func);
}