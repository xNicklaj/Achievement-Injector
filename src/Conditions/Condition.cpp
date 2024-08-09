#include "Condition.h"



Condition::Condition(ConditionType type) {
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
bool Condition::CheckCondition() { return false; }
void Condition::SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager) {
	this->eventManager = eventManager;
}

// QuestStageDoneCondition - V


// PlayerLevelCondition - V


// PlayerSkillLevelCondition - V


// ItemInInventoryCondition - V


// LocationDiscoveryCondition



// DragonSoulAbsorbedCondition - V

// PlayerActivationCondition - Kind of V


// QuestStageDoneConditionFactory






