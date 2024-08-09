#include "Settings.h"
#include "log.h"

void Settings::SerializeINI(const wchar_t* a_path, const std::function<void(CSimpleIniA&)> a_func, bool a_generate)
{
	CSimpleIniA ini;
	ini.SetUnicode();

	if (const auto rc = ini.LoadFile(a_path); !a_generate && rc < SI_OK) {
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

void Settings::LoadSettings() const
{
	LoadMCMSettings();
	SetupLog();
}

void Settings::LoadMCMSettings() const
{
	constexpr auto load_mcm = [](auto& ini) {
		Settings::GetSingleton()->bDebug = ini.GetBoolValue("General", "bDebug", false);
		Settings::GetSingleton()->bGlobal = ini.GetBoolValue("General", "bGlobal", false);
	};

	SerializeINI(defaultMCMPath, userMCMPath, load_mcm);
}

void Settings::SerializeMCM(std::function<void(CSimpleIniA&)> a_func)
{
	SerializeINI(defaultMCMPath, a_func);
}