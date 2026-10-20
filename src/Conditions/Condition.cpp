#include "Condition.h"



Condition::Condition() : Runnable(json::array()) {}
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
void Condition::SetConditionParameters(std::string, std::string, std::string) {}
void Condition::SetConditionParameters(std::string, float) {}
void Condition::SetConditionParameters(std::string, std::string, float) {}
bool Condition::IsValidOperation(const std::string& op) {
	return op == ">=" || op == "GT" || op == "==" || op == "EQ" ||
		op == "<" || op == "LT" || op == "<=" || op == "LE" || op == "!=" || op == "NE";
}
bool Condition::CompareValues(const std::string& op, float actual, float expected) {
	if (op == ">=" || op == "GT") return actual >= expected;
	if (op == "==" || op == "EQ") return actual == expected;
	if (op == "<" || op == "LT") return actual < expected;
	if (op == "<=" || op == "LE") return actual <= expected;
	if (op == "!=" || op == "NE") return actual != expected;
	return false;
}
void Condition::SetConditionParameters(std::string, bool) {}
void Condition::SetConditionParameters(std::vector<std::string>, int) {}
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
    // Fire once: a sink that outlives its purpose must not re-run onUnlock or re-save
    if (this->isMet) return;
    this->isMet = true;
    this->eventManager->dispatch("ConditionMet");
    this->RunAll();
}
