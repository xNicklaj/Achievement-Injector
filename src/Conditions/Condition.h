
#pragma once

#include <string>
#include <eventpp/eventdispatcher.h>
#include "../CommonFunctions.h"
#include "../log.h"
#include "../Runnable.h"
#include "../KeyedSink.h"
#include <SKSE/SKSE.h>
#include <RE/Skyrim.h>
#include <nlohmann/json.hpp>
#include "../LocalizationManager.h"
#include <functional>

#ifndef CONDITION_H
#define CONDITION_H

using json = nlohmann::json;

class Condition : public Runnable {
public:
	Condition();

	virtual void EnableListener(void);
	virtual void OnDataLoaded(void);
	virtual void SetConditionParameters(std::string, int);
	virtual void SetConditionParameters(int);
	virtual void SetConditionParameters(std::string, std::string, int);
	virtual void SetConditionParameters(std::string);
	virtual void SetConditionParameters(std::string, std::string);
	virtual void SetConditionParameters(std::string, std::string, std::string);
	virtual void SetConditionParameters(std::string, float);
	virtual void SetConditionParameters(std::string, std::string, float);
    virtual void SetConditionParameters(std::string, bool);
    virtual void SetConditionParameters(std::vector<std::string>, int);
	virtual bool CheckCondition();
	// Live conditions ("live": true) never latch: the achievement re-reads Evaluate() each time another condition fires.
	virtual bool SupportsLive() { return false; }
	virtual bool Evaluate() { return false; }
	virtual void Localize(std::string);
	virtual int Serialize(void);
	virtual bool Deserialize(int); // Returns true if condition is met
	
	void SetEventManager(eventpp::EventDispatcher<std::string, void()>* eventManager);
	void SetPlugin(std::string plugin);
	void UnlockNotify();
	// Accepts ">="/"GT", "=="/"EQ", "<"/"LT", "<="/"LE", "!="/"NE"; unknown operators never match.
	static bool IsValidOperation(const std::string& op);
	static bool CompareValues(const std::string& op, float actual, float expected);
	
	bool isMet = false;
	bool live = false;
	bool negate = false; // only meaningful with live: met while Evaluate() is false
	std::string plugin = "Skyrim.esm";
protected:
	eventpp::EventDispatcher<std::string, void()>* eventManager;
};


#endif