
#pragma once

#include <string>
#include <eventpp/eventdispatcher.h>
#include "../CommonFunctions.h"
#include "../log.h"
#include "../Runnable.h"
#include <SKSE/SKSE.h>
#include <RE/Skyrim.h>
#include <nlohmann/json.hpp>
#include "../LocalizationManager.h"
#include <functional>

#ifndef CONDITION_H
#define CONDITION_H

using json = nlohmann::json;

enum ConditionType {
	QuestStageDone, // Done
	QuestObjectiveDone, // Done
	PlayerLevel, // Done
	SkillLevel, // Done
	DungeonCleared, 
	ItemCrafted, // Done
	ItemInInventory, // Done
	LocationDiscovery, // Done
	LocationCleared, // Done
	PlayerActivation, // Done
	DragonSoulAbsorbed, // Done
	FirstEnterCell, // Done
	BookRead, // Done
	ShoutLearned, 
	GlobalVariableState, // Done
	QueryStatValue, // Done
	ActorDeath, // Done
	BaseActorDeath, // Done
	SpellLearned, // Done
	NotSet // Done
};

class Condition : public Runnable {
public:
	Condition(ConditionType type);
	Condition(ConditionType type, json jsonData);

	virtual void EnableListener(void);
	virtual void OnDataLoaded(void);
	virtual void SetConditionParameters(std::string, int);
	virtual void SetConditionParameters(int);
	virtual void SetConditionParameters(std::string, std::string, int);
	virtual void SetConditionParameters(std::string);
	virtual void SetConditionParameters(std::string, std::string);
	virtual void SetConditionParameters(std::string, float);
	virtual bool CheckCondition();
	virtual void Localize(std::string);
	virtual int Serialize(void);
	virtual bool Deserialize(int); // Returns true if condition is met
	
	void SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager);
	void SetPlugin(std::string plugin);
	void UnlockNotify();
	
	ConditionType type;
	bool isMet = false;
	std::string plugin = "Skyrim.esm";
protected:
	eventpp::EventDispatcher<std::string, void()>* eventManager;
};

class ConditionFactory {
public:
	virtual Condition* createCondition() = 0;
	virtual ~ConditionFactory() {};
};


#endif