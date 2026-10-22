#include "ConditionsMetCondition.h"
#include "../ConditionFactory.h"
#include "../../Utility.h"
#include <fmt/format.h>

#include <algorithm>

ConditionsMetCondition::ConditionsMetCondition() : Condition() {
	childEvents.appendListener("ConditionMet", [this]() { OnChildMet(); });
	// A child's progress changed: the achievement has to save it
	childEvents.appendListener("SerializationRequested", [this]() { if (eventManager) eventManager->dispatch("SerializationRequested"); });
}

void ConditionsMetCondition::SetParameters(int quantity_a, json& conditions, const std::string& plugin, const std::string& groupName, const std::string& achievementName) {
	for (json& entry : conditions) {
		Condition* child = CreateCondition(entry, plugin, groupName, achievementName);
		if (!child) continue;
		if (child->live) {
			logger::warn("[{}.json] \"live\"/\"negate\" is not supported inside ConditionsMet in {}. Skipping sub-condition.", groupName, achievementName);
			delete child;
			continue;
		}
		children.push_back(child);
	}
	if (quantity_a < 1 || quantity_a > static_cast<int>(children.size()))
		throw std::invalid_argument(fmt::format("ConditionsMet quantity {} must be between 1 and the {} usable sub-conditions", quantity_a, children.size()));
	quantity = quantity_a;
}

void ConditionsMetCondition::EnableListener(void) {
	done = false;
	for (Condition* child : children) {
		if (child->isMet) continue;
		if (!CheckIfModIsLoaded(child->plugin)) {
			logger::warn("Plugin {} not loaded. Skipping condition.", child->plugin);
			continue;
		}
		child->SetEventManager(&childEvents);
		child->EnableListener();
	}
}

void ConditionsMetCondition::StopListening(void) {
	for (Condition* child : children) child->StopListening();
}

void ConditionsMetCondition::SerializeChildren(std::vector<int>& out) {
	for (Condition* child : children) out.push_back(child->Serialize());
	for (Condition* child : children) child->SerializeChildren(out);
}

size_t ConditionsMetCondition::LoadChildren(const std::vector<int>& state, size_t offset) {
	for (size_t i = 0; i < children.size(); i++) {
		Condition* child = children[i];
		// No saved value (new character, or progress saved before this condition existed): start from zero
		child->isMet = child->Deserialize(offset + i < state.size() ? state[offset + i] : 0);
	}
	offset += children.size();
	for (Condition* child : children) offset = child->LoadChildren(state, offset);
	return offset;
}

void ConditionsMetCondition::OnChildMet() {
	// A child stopped mid-dispatch can still report once more
	if (done) return;
	if (std::count_if(children.begin(), children.end(), [](Condition* c) { return c->isMet; }) < quantity) {
		eventManager->dispatch("SerializationRequested");
		return;
	}
	done = true;
	StopListening();
	this->UnlockNotify();
}
