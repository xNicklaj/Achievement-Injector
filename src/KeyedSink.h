#pragma once

#include <RE/Skyrim.h>
#include <array>
#include <mutex>
#include <unordered_map>
#include <vector>

// One real game sink per event type. Conditions subscribe under the key their event carries (a form ID,
// a stat name), so an event only reaches the conditions that can care about it instead of every condition.
// Subscribers keep their own ProcessEvent and its filtering: a key only narrows who gets called.

// Key for a name. Case-insensitive, as stat names are in game; subscribers still do their own exact compare.
inline std::uint64_t StatKey(std::string_view stat) {
    std::uint64_t hash = 14695981039346656037ull;
    for (unsigned char c : stat) hash = (hash ^ static_cast<std::uint64_t>(std::tolower(c))) * 1099511628211ull;
    return hash;
}

// Source(): where the game sends E. Keys(e): every key e is delivered under.
template <class E>
struct KeyedEvent;

template <>
struct KeyedEvent<RE::TESQuestStageEvent> {
    static RE::BSTEventSource<RE::TESQuestStageEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESQuestStageEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESQuestStageEvent& e) { return {e.formID}; }
};

template <>
struct KeyedEvent<RE::TESTrackedStatsEvent> {
    static RE::BSTEventSource<RE::TESTrackedStatsEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESTrackedStatsEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESTrackedStatsEvent& e) { return {StatKey(e.stat.c_str() ? e.stat.c_str() : "")}; }
};

template <>
struct KeyedEvent<RE::TESContainerChangedEvent> {
    static RE::BSTEventSource<RE::TESContainerChangedEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESContainerChangedEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESContainerChangedEvent& e) { return {e.baseObj}; }
};

template <>
struct KeyedEvent<RE::TESSpellCastEvent> {
    static RE::BSTEventSource<RE::TESSpellCastEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESSpellCastEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESSpellCastEvent& e) { return {e.spell}; }
};

template <>
struct KeyedEvent<RE::TESMagicEffectApplyEvent> {
    static RE::BSTEventSource<RE::TESMagicEffectApplyEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESMagicEffectApplyEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESMagicEffectApplyEvent& e) { return {e.magicEffect}; }
};

template <>
struct KeyedEvent<RE::TESActivateEvent> {
    static RE::BSTEventSource<RE::TESActivateEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESActivateEvent>(); }
    static std::array<std::uint64_t, 1> Keys(const RE::TESActivateEvent& e) { return {e.objectActivated ? e.objectActivated->GetFormID() : 0}; }
};

// Delivered under the dying reference, its base actor and, for leveled spawns, the record it was templated from
template <>
struct KeyedEvent<RE::TESDeathEvent> {
    static RE::BSTEventSource<RE::TESDeathEvent>* Source() { return RE::ScriptEventSourceHolder::GetSingleton()->GetEventSource<RE::TESDeathEvent>(); }
    static std::array<std::uint64_t, 3> Keys(const RE::TESDeathEvent& e) {
        if (!e.actorDying) return {0, 0, 0};
        const auto* base = e.actorDying->GetBaseObject();
        const auto* templateBase = e.actorDying->GetTemplateActorBase();
        return {e.actorDying->GetFormID(), base ? base->GetFormID() : 0, templateBase ? templateBase->GetFormID() : 0};
    }
};

template <>
struct KeyedEvent<RE::BGSActorCellEvent> {
    static RE::BSTEventSource<RE::BGSActorCellEvent>* Source() { return RE::PlayerCharacter::GetSingleton()->AsBGSActorCellEventSource(); }
    static std::array<std::uint64_t, 1> Keys(const RE::BGSActorCellEvent& e) { return {e.cellID}; }
};

RE::TESObjectREFR* FindMapMarkerByData(RE::MapMarkerData* a_data);  // LocationDiscoveryCondition.cpp

// Delivered under both the discovered marker and its name. The marker list is searched once per event here,
// not once per subscriber.
template <>
struct KeyedEvent<RE::LocationDiscovery::Event> {
    static RE::BSTEventSource<RE::LocationDiscovery::Event>* Source() { return RE::LocationDiscovery::GetEventSource(); }
    static std::array<std::uint64_t, 2> Keys(const RE::LocationDiscovery::Event& e) {
        if (!e.mapMarkerData) return {0, 0};
        const auto* marker = FindMapMarkerByData(e.mapMarkerData);
        const char* name = e.mapMarkerData->locationName.GetFullName();
        return {marker ? marker->GetFormID() : 0, StatKey(name ? name : "")};
    }
};

template <class E>
class KeyedSink : public RE::BSTEventSink<E> {
public:
    using Sink = RE::BSTEventSink<E>;

    static KeyedSink* GetSingleton() {
        static KeyedSink instance;
        return &instance;
    }

    void Subscribe(std::uint64_t key, Sink* sink) {
        std::lock_guard lock(mutex);
        Add(byKey[key], sink);
    }

    // For subscribers whose match cannot be expressed as a key (a name, a substring): they get every event
    void SubscribeAll(Sink* sink) {
        std::lock_guard lock(mutex);
        Add(unkeyed, sink);
    }

    void Unsubscribe(Sink* sink) {
        std::lock_guard lock(mutex);
        std::erase(unkeyed, sink);
        for (auto& [key, sinks] : byKey) std::erase(sinks, sink);
    }

    void Clear() {
        std::lock_guard lock(mutex);
        unkeyed.clear();
        byKey.clear();
    }

    RE::BSEventNotifyControl ProcessEvent(const E* a_event, RE::BSTEventSource<E>* a_source) override {
        if (!a_event) return RE::BSEventNotifyControl::kContinue;
        // Copied out: a subscriber unsubscribes itself from inside its ProcessEvent once it is met
        std::vector<Sink*> targets;
        {
            std::lock_guard lock(mutex);
            targets = unkeyed;
            std::uint64_t previous = 0;
            for (std::uint64_t key : KeyedEvent<E>::Keys(*a_event)) {
                // 0 is "no key"; the previous-key check stops one subscriber being called twice for one event
                if (key == 0 || key == previous) continue;
                previous = key;
                if (auto it = byKey.find(key); it != byKey.end()) targets.insert(targets.end(), it->second.begin(), it->second.end());
            }
        }
        for (Sink* target : targets) target->ProcessEvent(a_event, a_source);
        return RE::BSEventNotifyControl::kContinue;
    }

private:
    void Add(std::vector<Sink*>& sinks, Sink* sink) {
        if (std::find(sinks.begin(), sinks.end(), sink) == sinks.end()) sinks.push_back(sink);
        // Hooked on first use: the player's event sources do not exist yet when the plugin loads
        if (!hooked) {
            hooked = true;
            KeyedEvent<E>::Source()->AddEventSink(this);
        }
    }

    std::recursive_mutex mutex;
    std::unordered_map<std::uint64_t, std::vector<Sink*>> byKey;
    std::vector<Sink*> unkeyed;
    bool hooked = false;
};

// A character switch re-subscribes everything from scratch
inline void ClearKeyedSinks() {
    KeyedSink<RE::TESQuestStageEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESContainerChangedEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESActivateEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESSpellCastEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESMagicEffectApplyEvent>::GetSingleton()->Clear();
    KeyedSink<RE::TESDeathEvent>::GetSingleton()->Clear();
    KeyedSink<RE::BGSActorCellEvent>::GetSingleton()->Clear();
    KeyedSink<RE::LocationDiscovery::Event>::GetSingleton()->Clear();
}
