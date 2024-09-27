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

template <typename T>
bool Settings::AssignValue(CSimpleIniA* ini, T* setting, std::string section, std::string key) {
	const char* value = nullptr;
	value = ini->GetValue(section.c_str(), key.c_str());
	if (value == nullptr) return false;
	if constexpr (std::is_same<T, bool>::value) {
		*setting = ini->GetBoolValue(section.c_str(), key.c_str());
	}
	else if constexpr (std::is_same<T, int>::value) {
		*setting = ini->GetLongValue(section.c_str(), key.c_str());
    } 
	else if constexpr (std::is_same<T, float>::value) {
        *setting = std::stof(std::string(value));
	}
	else if constexpr (std::is_same<T, std::string>::value) {
		*setting = *value;
	}
	else{
		logger::error("Unsupported type");
		return false;
	}
	return true;
}


void Settings::LoadMCMSettings() const
{
	constexpr auto load_mcm = [](auto& ini) {
		std::string tmp;
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bDebug), "Main", "bDebug");
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bUseDebugger), "Main", "bUseDebugger");
		bool tmpGlobal = Settings::GetSingleton()->GetGlobal();
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(tmpGlobal), "Main", "bGlobal");
		if (tmpGlobal != Settings::GetSingleton()->bGlobal)
		{
			Settings::GetSingleton()->bGlobal = tmpGlobal;
			AchievementManager::GetSingleton()->UpdateCache();
		}
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bUsePopup), "Main", "bUsePopup");
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bDelayNewGameAlert), "Main", "bDelayNewGameAlert");
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bShowHidden), "Main", "bShowHidden");
        Settings::GetSingleton()->AssignValue<int>(&ini, &(Settings::GetSingleton()->iWidgetYOffset), "Main", "iWidgetYOffset");
        Settings::GetSingleton()->AssignValue<float>(&ini, &(Settings::GetSingleton()->fWidgetScale), "Main", "fWidgetScale");

		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bOverrideNotificationSound), "Sound", "bOverrideNotificationSound");
		Settings::GetSingleton()->AssignValue<bool>(&ini, &(Settings::GetSingleton()->bMute), "Sound", "bMute");

		int tmpLong = 0;
		if (Settings::GetSingleton()->AssignValue<int>(&ini, &(tmpLong), "Sound", "iNotificationSound")) {
			switch (tmpLong)
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
		}
		
	};
	SerializeINI(defaultMCMPath, userMCMPath, load_mcm);
}

void Settings::SerializeMCM(std::function<void(CSimpleIniA&)> a_func)
{
	SerializeINI(defaultMCMPath, a_func);
}