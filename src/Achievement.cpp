#include "Achievement.h"

#include <string>
#include <memory>
#include "ConditionsJoinType.h"
#include "Condition.h"
#include "Serializer.h"

Achievement::Achievement(json& jsonData)
    : achievementName(jsonData["achievementName"]),
    description(jsonData["description"]),
    joinType(jsonData.value("joinType", ConditionsJoinType::OR)),
    unlocked(false) {  // Initialize joinType and unlocked
    this->eventHandler.appendListener("ConditionMet", [this]() {
        this->OnConditionMet();
    });

    for (json condition : jsonData["conditions"]) {
        if (condition["type"] == "QuestStageDone") {
            QuestStageDoneConditionFactory* questStageDoneConditionFactory = new QuestStageDoneConditionFactory();
            Condition* questStageDoneCondition = questStageDoneConditionFactory->createCondition();
            questStageDoneCondition->SetConditionParameters(condition["questID"], condition["stage"]);
            conditions.push_back(questStageDoneCondition);
        }
		else if (condition["type"] == "PlayerLevel") {
			PlayerLevelConditionFactory* playerLevelConditionFactory = new PlayerLevelConditionFactory();
			Condition* playerLevelCondition = playerLevelConditionFactory->createCondition();
			playerLevelCondition->SetConditionParameters(condition["level"]);
			conditions.push_back(playerLevelCondition);
		}
        else if (condition["type"] == "SkillLevel") {
            PlayerSkillLevelConditionFactory* skillLevelConditionFactory = new PlayerSkillLevelConditionFactory();
			Condition* skillLevelCondition = skillLevelConditionFactory->createCondition();
			skillLevelCondition->SetConditionParameters(condition["skill"], condition["level"]);
			conditions.push_back(skillLevelCondition);
        }
        else if (condition["type"] == "ItemInInventory") {
            ItemInInventoryConditionFactory* itemInInventoryConditionFactory = new ItemInInventoryConditionFactory();
            Condition* itemInInventoryCondition = itemInInventoryConditionFactory->createCondition();
            itemInInventoryCondition->SetConditionParameters(condition["itemFormID"], condition["quantity"]);
            conditions.push_back(itemInInventoryCondition);
        }
        else if (condition["type"] == "LocationDiscovery") {
            LocationDiscoveryConditionFactory* locationDiscoveryConditionFactory = new LocationDiscoveryConditionFactory();
            Condition* locationDiscoveryCondition = locationDiscoveryConditionFactory->createCondition();
            locationDiscoveryCondition->SetConditionParameters(condition["locationID"], condition["worldspaceID"], condition["quantity"]);
            conditions.push_back(locationDiscoveryCondition);
        }
        else if (condition["type"] == "DragonSoulAbsorbed") {
            DragonSoulAbsorbedConditionFactory* dragonSoulAbsorbedConditionFactory = new DragonSoulAbsorbedConditionFactory();
            Condition* dragonSoulAbsorbedCondition = dragonSoulAbsorbedConditionFactory->createCondition();
            dragonSoulAbsorbedCondition->SetConditionParameters(condition["quantity"]);
            conditions.push_back(dragonSoulAbsorbedCondition);
        }
        else {
            logger::warn("Unknown condition type");
        }
    }
}

void Achievement::EnableListener(void) {
	// Enable listener for this achievement
    for (Condition* condition : conditions) {
        condition->SetEventManager(&eventHandler);
		condition->EnableListener();
	}
}

void Achievement::OnConditionMet(void) {
    bool allConditionsMet = false;
    switch (this->joinType) {
    case ConditionsJoinType::OR:
        allConditionsMet = false;
        for (Condition* condition : conditions) {
            if (condition->isMet == true) {
                allConditionsMet = true;
                break;
            }
        }
		break;
    case ConditionsJoinType::AND:
        allConditionsMet = true;
        for (Condition* condition : conditions) {
            if (condition->isMet == false) {
                allConditionsMet = false;
                break;
            }
        }
        break;
    }

    if (allConditionsMet) {
        logger::info("Achievement {} unlocked", achievementName);
    }
}