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
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH + filename);
        }
	}

    if (std::filesystem::exists(LOCALIZATION_PATH_2)) {
        for (const auto& entry : std::filesystem::directory_iterator(LOCALIZATION_PATH_2)) {
            std::string filename = entry.path().filename().string();
            std::string locale = StripExtension(filename.substr(filename.find_last_of('_') + 1));
            std::string groupName = filename.substr(0, filename.find_last_of('_'));

            // TODO Maybe read only my locale
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH_2 + filename);
        }
    }
}

std::map<std::string, std::string> LocalizationManager::ReadLocalizationFile(const std::string& filename) {
    std::map<std::string, std::string> keyValueMap;
    std::ifstream file(filename);
    std::string line;

    if (file.is_open()) {
        while (std::getline(file, line)) {
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
    }
    else {
        std::cerr << "Unable to open file: " << filename << std::endl;
    }

    return keyValueMap;
}

std::string LocalizationManager::GetLocalizedText(std::string group, std::string locale, std::string key) {

	try {
        return this->localizations[std::tuple<std::string, std::string>(group, locale)][key];
	}
	catch (const std::out_of_range& e) {
		logger::error("Localization not found for group: {}, locale: {}, key: {}", group, locale, key);
	}
	return "NOTFOUND";
}