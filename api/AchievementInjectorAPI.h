// Achievement Injector C++ API. Copy this header into your plugin; it only needs the SKSE/CommonLibSSE headers.
//
// Unlock event (no linking needed):
//     SKSE::GetMessagingInterface()->RegisterListener("AchievementInjector", [](SKSE::MessagingInterface::Message* m) {
//         if (m->type == AchievementInjectorAPI::kUnlocked) {
//             auto* e = static_cast<AchievementInjectorAPI::UnlockedMessage*>(m->data);
//         }
//     });
//
// Queries (call after kPostLoad, e.g. on kDataLoaded):
//     auto* api = AchievementInjectorAPI::RequestInterface();
//     if (api && api->IsUnlocked("MyGroup", "My Achievement")) { ... }
// RequestInterfaceV2() returns the same object with the extra getters, or null on an older Achievement Injector.
#pragma once

#include <cstddef>
#include <cstdint>

namespace AchievementInjectorAPI {
    inline constexpr auto kPluginName = "AchievementInjector";

    enum MessageType : std::uint32_t {
        kUnlocked = 'AIUN',          // broadcast on unlock; data is an UnlockedMessage
        kRequestInterface = 'AIRQ',  // send to kPluginName; data is an IAchievementInjectorV1** to fill
    };

    // Strings are only valid during the callback: copy what you keep.
    // The callback runs on the thread that evaluated the condition, not necessarily the main thread.
    struct UnlockedMessage {
        const char* group;     // group id, the json file name without extension
        const char* name;      // achievement name, localized if the json used a "$key"
        const char* plugin;    // plugin the achievement belongs to
        bool retroactive;      // true when found met while loading a save, not earned in play
    };

    // Never changed once released: additions go in a IAchievementInjectorV2 that derives from this.
    class IAchievementInjectorV1 {
    public:
        virtual std::uint32_t GetVersion() = 0;  // 1
        // For the currently loaded character. group is the json file name without extension; name is case-insensitive and may be a "$key".
        virtual bool IsUnlocked(const char* group, const char* name) = 0;
        // Unlocks it as if its conditions were met. False if the group or achievement doesn't exist.
        virtual bool Unlock(const char* group, const char* name) = 0;
    };

    // String getters copy into buf (always null-terminated when size > 0) and return the full length without the
    // terminator, like snprintf: pass buf = nullptr, size = 0 to measure first. Group ids and names that don't exist return 0.
    class IAchievementInjectorV2 : public IAchievementInjectorV1 {
    public:
        // Unix time the character unlocked it, or -1 if locked or not found.
        virtual std::int64_t GetUnlockTime(const char* group, const char* name) = 0;

        // Groups and achievements in file order, including ones the menu hides. i is 0-based.
        virtual std::uint32_t GetGroupCount() = 0;
        virtual std::size_t GetGroupId(std::uint32_t i, char* buf, std::size_t size) = 0;
        virtual std::uint32_t GetAchievementCount(const char* group) = 0;  // the group's total; 0 if it doesn't exist
        virtual std::uint32_t GetUnlockedCount(const char* group) = 0;
        virtual std::size_t GetAchievementName(const char* group, std::uint32_t i, char* buf, std::size_t size) = 0;

        virtual std::size_t GetDescription(const char* group, const char* name, char* buf, std::size_t size) = 0;
        virtual bool IsHidden(const char* group, const char* name) = 0;  // description hidden until unlocked
    };

    inline IAchievementInjectorV1* RequestInterface() {
        IAchievementInjectorV1* api = nullptr;
        SKSE::GetMessagingInterface()->Dispatch(kRequestInterface, &api, sizeof(api), kPluginName);
        return api;
    }

    // Null if the installed Achievement Injector predates V2
    inline IAchievementInjectorV2* RequestInterfaceV2() {
        auto* api = RequestInterface();
        return api && api->GetVersion() >= 2 ? static_cast<IAchievementInjectorV2*>(api) : nullptr;
    }
}
