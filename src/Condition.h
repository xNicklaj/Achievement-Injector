
#pragma once

#include <string>
#include <eventpp/eventdispatcher.h>
#include "CommonFunctions.h"

#ifndef CONDITION_H
#define CONDITION_H

enum ConditionType {
	QuestStageDone, // Done
	PlayerLevel, // Done
	SkillLevel, // done
	DungeonCleared,
	ItemInInventory, // Done
	LocationDiscovery, // Maybe
	PlayerActivation,
	DragonSoulAbsorbed, // Done
	NotSet
};

// Conditions

class Condition {
public:
	Condition(ConditionType type);

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

class QuestStageDoneCondition : public Condition, public RE::BSTEventSink<RE::TESQuestStageEvent> {
public:
	QuestStageDoneCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string questId, int stage) override;
	bool CheckCondition() override;

	std::string questId;
	int stage = 200;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESQuestStageEvent* a_event, RE::BSTEventSource<RE::TESQuestStageEvent>*) override;
};

class PlayerLevelCondition : public Condition, public RE::BSTEventSink<RE::LevelIncrease::Event> {
public:
	PlayerLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(int level) override;
	bool CheckCondition() override;

	int level = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) override;
};

class PlayerSkillLevelCondition : public Condition, public RE::BSTEventSink<RE::SkillIncrease::Event> {
public:
	PlayerSkillLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string skill, int level) override;
	bool CheckCondition() override;

	std::string skill;
	int level = 0;

private:
	RE::BSEventNotifyControl ProcessEvent(const RE::SkillIncrease::Event* a_event, RE::BSTEventSource<RE::SkillIncrease::Event>*) override;
};

class ItemInInventoryCondition : public Condition, public RE::BSTEventSink<RE::TESContainerChangedEvent> {
public:
	ItemInInventoryCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid, int quantity) override;
	bool CheckCondition() override;

	std::string formid;
	int quantity = 1;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESContainerChangedEvent* a_event, RE::BSTEventSource<RE::TESContainerChangedEvent>*) override;
};

class LocationDiscoveryCondition : public Condition, public RE::BSTEventSink<RE::LocationDiscovery::Event> {
public:
	LocationDiscoveryCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string locationName, std::string worldspaceID) override;
	bool CheckCondition(std::string locationName, std::string worldspaceID);

	std::string locationName;
	std::string worldspaceID;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LocationDiscovery::Event* a_event, RE::BSTEventSource<RE::LocationDiscovery::Event>*) override;
};

class DragonSoulAbsorbedCondition : public Condition, public RE::BSTEventSink<RE::DragonSoulsGained::Event> {
public:
	DragonSoulAbsorbedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(int quantity) override;
	bool CheckCondition() override;

	int quantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::DragonSoulsGained::Event* a_event, RE::BSTEventSource<RE::DragonSoulsGained::Event>*) override;
};

class PlayerActivationCondition : public Condition, public RE::BSTEventSink<RE::TESActivateEvent> {
public:
	PlayerActivationCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESActivateEvent* a_event, RE::BSTEventSource<RE::TESActivateEvent>*) override;
};
// Factories
class ConditionFactory {
public:
	virtual Condition* createCondition() = 0;
	virtual ~ConditionFactory() {};
};

class QuestStageDoneConditionFactory : public ConditionFactory {
public:
	QuestStageDoneConditionFactory();
	Condition* createCondition() override;
};

class PlayerLevelConditionFactory : public ConditionFactory {
public:
	PlayerLevelConditionFactory();
	Condition* createCondition() override;
};

class PlayerSkillLevelConditionFactory : public ConditionFactory {
public:
	PlayerSkillLevelConditionFactory();
	Condition* createCondition() override;
};

class ItemInInventoryConditionFactory : public ConditionFactory {
public:
	ItemInInventoryConditionFactory();
	Condition* createCondition() override;
};

class LocationDiscoveryConditionFactory : public ConditionFactory {
	public:
	LocationDiscoveryConditionFactory();
	Condition* createCondition() override;
};

class DragonSoulAbsorbedConditionFactory : public ConditionFactory {
public:
	DragonSoulAbsorbedConditionFactory();
	Condition* createCondition() override;
};

class PlayerActivationConditionFactory : public ConditionFactory {
	public:
	PlayerActivationConditionFactory();
	Condition* createCondition() override;
};
#endif

//struct PlayerLevelCondition : Condition {
//	int level = 0;
//
//	PlayerLevelCondition(int level) : Condition(PlayerLevel), level(level) {}
//};
//
//struct SkillLevelCondition : Condition {
//	std::string skill;
//	int level = 0;
//
//	SkillLevelCondition(std::string skill, int level) : Condition(SkillLevel), skill(skill), level(level) {}
//};
//
//struct DungeonClearedCondition : Condition {
//	std::string dungeonId = "*";
//	int count = 1;
//
//	DungeonClearedCondition(std::string dungeonId, int count) : Condition(DungeonCleared), dungeonId(dungeonId), count(count) {}
//};
//
//struct ItemInInventoryCondition : Condition {
//	std::string itemFormID;
//	int quantity = 1;
//
//	ItemInInventoryCondition(std::string itemFormID, int quantity) : Condition(ItemInInventory), itemFormID(itemFormID), quantity(quantity) {}
//};