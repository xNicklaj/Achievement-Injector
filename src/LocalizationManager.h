#include "Singleton.h"
#include <map>
#include <tuple>

#ifndef LOCALIZATIONMANAGER_H
#define LOCALIZATIONMANAGER_H

#define LOCALIZATION_PATH "Data/AchievementsData/Localizations/"
#define LOCALIZATION_PATH_2 "Data/SKSE/Plugins/AchievementsData/Localizations/"

class LocalizationManager : public ISingleton<LocalizationManager> {
public:
	LocalizationManager();
	void LoadLocalizations();
	static std::map<std::string, std::string> ReadLocalizationFile(const std::string& filename);
	std::string GetLocalizedText(std::string group, std::string locale, std::string key);
	std::string CurrentLocale() { return currentLocale; }

private:
	std::map<std::tuple<std::string, std::string>, std::map<std::string, std::string>> localizations;
	std::string currentLocale;
};

#endif