#include "log.h"
#include "settings.h"


std::optional<std::filesystem::path> GetLogDirectory() {
    using namespace std::filesystem;
    PWSTR buf;
    SHGetKnownFolderPath(FOLDERID_Documents, KF_FLAG_DEFAULT, nullptr, &buf);
    std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> documentsPath{buf, CoTaskMemFree};
    path directory{documentsPath.get()};
    directory.append("My Games"sv);

    if (exists("steam_api64.dll"sv)) {
        if (exists("openvr_api.dll") || exists("Data/SkyrimVR.esm")) {
            directory.append("Skyrim VR"sv);
        } else {
            directory.append("Skyrim Special Edition"sv);
        }
    } else if (exists("Galaxy64.dll"sv)) {
        directory.append("Skyrim Special Edition GOG"sv);
    } else if (exists("eossdk-win64-shipping.dll"sv)) {
        directory.append("Skyrim Special Edition EPIC"sv);
    } else {
        return current_path().append("skselogs");
    }
    return directory.append("SKSE"sv).make_preferred();
}

void SetupLog(bool cleanFile) {
    auto path = GetLogDirectory();
    if (!path) {
        //report_and_fail("Can't find SKSE log directory");
    }
    *path /= std::format("{}.log"sv, SKSE::PluginDeclaration::GetSingleton()->GetName());

    std::shared_ptr<spdlog::logger> log;
    auto fileLoggerPtr = std::make_shared<spdlog::sinks::basic_file_sink_mt>(path->string(), cleanFile);
    auto loggerPtr = std::make_shared<spdlog::logger>("log", std::move(fileLoggerPtr));
    spdlog::set_default_logger(std::move(loggerPtr));

    if (Settings::GetSingleton()->GetDebug()) {
        logger::info("Debug enabled.");
        spdlog::set_level(spdlog::level::trace);
        spdlog::flush_on(spdlog::level::trace);
    } else {
        spdlog::set_level(spdlog::level::info);
        spdlog::flush_on(spdlog::level::info);
    }
}