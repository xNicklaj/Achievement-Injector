#include "LocalizationManager.h"
#include "CommonFunctions.h"
#include "settings.h"

// Scaleform and the save file both need UTF-8; accept ANSI-saved files by converting them
static std::string ToUtf8(const std::string& s) {
    const int len = static_cast<int>(s.size());
    if (len == 0 || MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s.data(), len, nullptr, 0) > 0) return s;
    std::wstring wide(MultiByteToWideChar(CP_ACP, 0, s.data(), len, nullptr, 0), L'\0');
    MultiByteToWideChar(CP_ACP, 0, s.data(), len, wide.data(), static_cast<int>(wide.size()));
    std::string out(WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()), nullptr, 0, nullptr, nullptr), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()), out.data(), static_cast<int>(out.size()), nullptr, nullptr);
    return out;
}

// Locales are compared uppercase: the ini may say English or ENGLISH, and a BSA lowercases file names (hotm_en.txt)
static std::string ToUpper(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return s;
}

LocalizationManager::LocalizationManager() {
    this->currentLocale = ToUpper(std::string(RE::GetINISetting("sLanguage:General")->GetString()).substr(0,2));
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
            std::string locale = ToUpper(StripExtension(filename.substr(filename.find_last_of('_') + 1)));
            std::string groupName = filename.substr(0, filename.find_last_of('_'));

            // TODO Maybe read only my locale
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH + filename);
        }
	}

    if (std::filesystem::exists(LOCALIZATION_PATH_2)) {
        for (const auto& entry : std::filesystem::directory_iterator(LOCALIZATION_PATH_2)) {
            std::string filename = entry.path().filename().string();
            std::string locale = ToUpper(StripExtension(filename.substr(filename.find_last_of('_') + 1)));
            std::string groupName = filename.substr(0, filename.find_last_of('_'));

            // TODO Maybe read only my locale
            localizations[std::tuple<std::string, std::string>(groupName, locale)] = LocalizationManager::ReadLocalizationFile(LOCALIZATION_PATH_2 + filename);
        }
    }

}

std::map<std::string, std::string> LocalizationManager::ReadLocalizationFile(const std::string& filename) {
    std::map<std::string, std::string> keyValueMap;
    std::stringstream buffer;
    std::ifstream file(filename);
    std::string line;
    std::string fileString;

    if (!file.is_open()) {
        logger::error("Unable to open file: {}", filename);
        return keyValueMap;
    }

    buffer << file.rdbuf();
    fileString = ToUtf8(buffer.str());

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
    // A missing key returns the key itself: an empty name would make every such achievement share one save entry
    for (const std::string& loc : {locale, std::string("EN")}) {
        const auto file = this->localizations.find(std::make_tuple(group, loc));
        if (file == this->localizations.end()) continue;
        const auto text = file->second.find(key);
        if (text != file->second.end() && !text->second.empty()) return text->second;
    }
    logger::error("Localization not found for group: {}, locale: {}, key: {}", group, locale, key);
    return key;
}