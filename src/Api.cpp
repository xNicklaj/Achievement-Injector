#include "Api.h"
#include <algorithm>
#include <cstring>
#include "AchievementManager.h"
#include "Serializer.h"

namespace Api {
    namespace {
        AchievementGroup* FindGroup(const char* group) {
            if (!group) return nullptr;
            for (auto& g: AchievementManager::GetSingleton()->achievementGroups) {
                if (_stricmp(g.groupid.c_str(), group) == 0) return &g;
            }
            return nullptr;
        }

        std::size_t CopyOut(const std::string& s, char* buf, std::size_t size) {
            if (buf && size > 0) {
                const auto n = std::min(s.size(), size - 1);
                std::memcpy(buf, s.data(), n);
                buf[n] = '\0';
            }
            return s.size();
        }

        Achievement* FindAchievement(const char* group, const char* name) {
            return group && name ? AchievementManager::GetSingleton()->Find(name, group) : nullptr;
        }

        class Interface : public AchievementInjectorAPI::IAchievementInjectorV2 {
        public:
            std::uint32_t GetVersion() override { return 2; }
            bool IsUnlocked(const char* group, const char* name) override {
                return group && name && AchievementManager::GetSingleton()->IsUnlocked(name, group);
            }
            bool Unlock(const char* group, const char* name) override {
                if (!group || !name || !AchievementManager::GetSingleton()->Find(name, group)) return false;
                AchievementManager::GetSingleton()->ForceUnlock(name, group);
                return true;
            }

            std::int64_t GetUnlockTime(const char* group, const char* name) override {
                auto* a = FindAchievement(group, name);
                if (!a || !a->unlocked) return -1;
                const auto sa = Serializer::GetSingleton()->DeserializeAchievementData(a->groupName, a->achievementName);
                return sa.unlocked ? sa.unlockDatetime : -1;
            }

            std::uint32_t GetGroupCount() override {
                return static_cast<std::uint32_t>(AchievementManager::GetSingleton()->achievementGroups.size());
            }
            std::size_t GetGroupId(std::uint32_t i, char* buf, std::size_t size) override {
                auto& groups = AchievementManager::GetSingleton()->achievementGroups;
                return i < groups.size() ? CopyOut(groups[i].groupid, buf, size) : 0;
            }
            std::uint32_t GetAchievementCount(const char* group) override {
                auto* g = FindGroup(group);
                return g ? static_cast<std::uint32_t>(g->achievements.size()) : 0;
            }
            std::uint32_t GetUnlockedCount(const char* group) override {
                auto* g = FindGroup(group);
                return g ? static_cast<std::uint32_t>(std::count_if(g->achievements.begin(), g->achievements.end(), [](Achievement* a) { return a->unlocked; })) : 0;
            }
            std::size_t GetAchievementName(const char* group, std::uint32_t i, char* buf, std::size_t size) override {
                auto* g = FindGroup(group);
                return g && i < g->achievements.size() ? CopyOut(g->achievements[i]->achievementName, buf, size) : 0;
            }

            std::size_t GetDescription(const char* group, const char* name, char* buf, std::size_t size) override {
                auto* a = FindAchievement(group, name);
                return a ? CopyOut(a->description, buf, size) : 0;
            }
            bool IsHidden(const char* group, const char* name) override {
                auto* a = FindAchievement(group, name);
                return a && a->hidden;
            }
        };

        Interface instance;

        // Registered with no sender filter: requests come from any plugin
        void OnMessage(SKSE::MessagingInterface::Message* a_msg) {
            if (a_msg->type != AchievementInjectorAPI::kRequestInterface || a_msg->dataLen != sizeof(void*)) return;
            *static_cast<AchievementInjectorAPI::IAchievementInjectorV1**>(a_msg->data) = &instance;
        }

        void OnUnlocked(AchievementUnlockedEvent* a_event) {
            AchievementInjectorAPI::UnlockedMessage msg{a_event->achievementGroup.c_str(), a_event->achievement->achievementName.c_str(),
                                                        a_event->achievement->plugin.c_str(), AchievementManager::GetSingleton()->retroactive};
            SKSE::GetMessagingInterface()->Dispatch(AchievementInjectorAPI::kUnlocked, &msg, sizeof(msg), nullptr);
        }
    }

    void Register() {
        // The one-argument overload only listens to "SKSE"; nullptr listens to every plugin
        SKSE::GetMessagingInterface()->RegisterListener(nullptr, OnMessage);
        AchievementManager::GetSingleton()->AddEventSink(OnUnlocked);
    }
}
