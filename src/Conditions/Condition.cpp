#include "Condition.h"



Condition::Condition(ConditionType type, json jsonData) : Runnable(jsonData.value("onUnlock", json::array())) {
    this->type = type;
}
Condition::Condition(ConditionType type) : Runnable(json::array()) {
    this->type = type;
}
void Condition::SetPlugin(std::string plugin) {
    this->plugin = plugin;
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
bool Condition::CheckCondition() { return false; }
void Condition::SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager) {
	this->eventManager = eventManager;
}

int Condition::Serialize() {
    return static_cast<int>(this->isMet);
}
bool Condition::Deserialize(int value) {
	this->isMet = static_cast<bool>(value);
    return this->isMet;
}

// QuestStageDoneCondition - V


// PlayerLevelCondition - V


// PlayerSkillLevelCondition - V


// ItemInInventoryCondition - V


// LocationDiscoveryCondition



// DragonSoulAbsorbedCondition - V

// PlayerActivationCondition - Kind of V


// QuestStageDoneConditionFactory






