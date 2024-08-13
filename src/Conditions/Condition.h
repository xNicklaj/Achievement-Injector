
#pragma once

#include <string>
#include <eventpp/eventdispatcher.h>
#include "../CommonFunctions.h"
#include "../log.h"
#include "../Runnable.h"
#include <SKSE/SKSE.h>
#include <RE/Skyrim.h>
#include <nlohmann/json.hpp>
#include <functional>

#ifndef CONDITION_H
#define CONDITION_H

using json = nlohmann::json;

enum ConditionType {
	QuestStageDone, // Done
	PlayerLevel, // Done
	SkillLevel, // Done
	DungeonCleared, 
	ItemCrafted, // Done
	ItemInInventory, // Done
	LocationDiscovery, // Done
	PlayerActivation, // Done
	DragonSoulAbsorbed, // Done
	FirstEnterCell, // Done
	BookRead, // Done
	PowerLearned, 
	GlobalVariableState,
	ActorDeath, // Done, only for references
	NotSet // Done
};

class Condition : Runnable {
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
	virtual bool CheckCondition();
	
	void SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager);
	void SetPlugin(std::string plugin);
	
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