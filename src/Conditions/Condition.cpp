#include "Condition.h"



Condition::Condition(ConditionType type, json jsonData) : Runnable(jsonData.value("onUnlock", json::array())) {
    this->type = type;
}
Condition::Condition(ConditionType type) : Runnable(json::array()) {
    this->type = type;
}
void Condition::SetPlugin(std::string plugin_a) {
    this->plugin = plugin_a;
}
void Condition::EnableListener() {}
void Condition::OnDataLoaded() {
    CheckCondition();
}
void Condition::SetConditionParameters(std::string, int){}
void Condition::SetConditionParameters(int) {}
void Condition::SetConditionParameters(std::string, std::string, int) {}
void Condition::SetConditionParameters(std::string) {}
void Condition::SetConditionParameters(std::string, std::string) {}
void Condition::SetConditionParameters(std::string, float) {}
void Condition::SetConditionParameters(std::string, bool) {}
bool Condition::CheckCondition() { return false; }
void Condition::SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager_a) {
	this->eventManager = eventManager_a;
}
void Condition::Localize(std::string) {}

int Condition::Serialize() {
    return static_cast<int>(this->isMet);
}
bool Condition::Deserialize(int value) {
	this->isMet = static_cast<bool>(value);
    return this->isMet;
}

void Condition::UnlockNotify() {
    this->isMet = true;
    this->eventManager->dispatch("ConditionMet");
    this->RunAll();
}

// QuestStageDoneCondition - V


// PlayerLevelCondition - V


// PlayerSkillLevelCondition - V


// ItemInInventoryCondition - V


// LocationDiscoveryCondition



// DragonSoulAbsorbedCondition - V

// PlayerActivationCondition - Kind of V


// QuestStageDoneConditionFactory






