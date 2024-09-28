#include "LocalizationManager.h"
#include "CommonFunctions.h"
#include "settings.h"

LocalizationManager::LocalizationManager() {
    this->currentLocale = std::string(RE::GetINISetting("sLanguage:General")->GetString()).substr(0,2);
    logger::info("Game settings is {}.", this->currentLocale);
    this->LoadLocalizations();
}

void LocalizationManager::LoadLocalizations() {
    for (auto& innermap : localizations) {
        innermap.second.clear();
    }
    localizations.clear();
    
	if (std::filesystem::exists(LOCALIZATION_PATH)) {
        for (const auto& entry : std::filesystem::directory_iterator(LOCALIZATION_PATH)) {

            std::string filename = entry.path().filename().string();
            std::string locale = StripExtension(filename.substr(filename.find_last_of('_') + 1));
            std::string groupName = filename.substr(0, filename.find_last_of('_'));

            // TODO Maybe read only my locale
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH + filename, false);
        }
	}

    if (std::filesystem::exists(LOCALIZATION_PATH_2)) {
        for (const auto& entry : std::filesystem::directory_iterator(LOCALIZATION_PATH_2)) {
            std::string filename = entry.path().filename().string();
            std::string locale = StripExtension(filename.substr(filename.find_last_of('_') + 1));
            std::string groupName = filename.substr(0, filename.find_last_of('_'));

            // TODO Maybe read only my locale
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH_2 + filename, false);
        }
    }

    /*std::string lang = RE::GetINISetting("sLanguage:General")->GetString();
    std::transform(lang.begin(), lang.end(), lang.begin(), [](unsigned char c) { return std::tolower(c); });

    std::map<std::string, std::string> tempMap;
    bool found = false;

    if (std::filesystem::exists("Data/interface/translations/AchievementInjector_" + lang + ".txt")) {
        tempMap = LocalizationManager::ReadLocalizationFile(std::filesystem::current_path().string() +
                                                            "\\Data\\interface\\translations\\AchievementInjector_" + lang + ".txt", true);
        if (tempMap.find("$ACH_HIDDEN") != tempMap.end()) {
            found = true;
            this->Ach_Hidden = tempMap["$ACH_HIDDEN"];
        }
    }
    
    if (!found && std::filesystem::exists("Data/interface/translations/AchievementInjector_english.txt")) {
        tempMap = LocalizationManager::ReadLocalizationFile(
            std::filesystem::current_path().string()  + "\\Data\\interface\\translations\\AchievementInjector_english.txt", true);
        if (tempMap.find("$ACH_HIDDEN") != tempMap.end()) {
            found = true;
            this->Ach_Hidden = tempMap["$ACH_HIDDEN"];
        }
    }
    
    if (!found) this->Ach_Hidden = "Hidden Description";*/
}

std::map<std::string, std::string> LocalizationManager::ReadLocalizationFile(const std::string& filename, bool utf16) {
    std::map<std::string, std::string> keyValueMap;
    std::stringstream buffer;
    std::ifstream file(filename);
    std::string line;
    std::string fileString;

    if (!file.is_open()) {
        logger::error("Unable to open file: {}", filename);
        return keyValueMap;
    }

    if (utf16) {
        fileString = utf16to8(filename);
    } else {
        buffer << file.rdbuf();
        fileString = buffer.str();
    }

    std::istringstream iss(fileString);

    while (std::getline(iss, line)) {
        size_t tabPos = line.find('\t');
        if (tabPos != std::string::npos && line[0] == '$') {
            size_t valueStart = tabPos + 1;
            // Skip multiple tabs
            while (valueStart < line.size() && line[valueStart] == '\t') {
                ++valueStart;
            }
            std::string key = line.substr(0, tabPos);
            std::string value = line.substr(valueStart);
            keyValueMap[key] = value;
        }
    }
    file.close();

    return keyValueMap;
}

std::string LocalizationManager::GetLocalizedText(std::string group, std::string locale, std::string key) {
    std::string localizedText = "NOTFOUND";
	try {
        std::tuple<std::string, std::string> keyTuple = std::tuple<std::string, std::string>(group, locale);
        if (this->localizations.find(keyTuple) == this->localizations.end()) {
            logger::error("Localization not found for group: {}, locale: {}, key: {}. Default to ENGLISH.", group, locale, key);
            keyTuple = std::tuple<std::string, std::string>(group, "EN");
        }
        localizedText = this->localizations[keyTuple][key];
	}
	catch (const std::out_of_range&) {
		logger::error("Localization not found for group: {}, locale: {}, key: {}", group, locale, key);
	}
	return localizedText;
}