#include "Achievement.h"

#include <string>
#include <memory>
#include "ConditionsJoinType.h"
#include "settings.h"
#include "Serializer.h"
#include "Utility.h"
#include "AchievementWidget.h"

#include "Conditions/DragonSoulAbsorbed/DragonSoulsAbsorbedCondition.h"
#include "Conditions/ItemInInventory/ItemInInventoryCondition.h"
#include "Conditions/LocationDiscovery/LocationDiscoveryCondition.h"
#include "Conditions/PlayerActivation/PlayerActivationCondition.h"
#include "Conditions/PlayerLevel/PlayerLevelCondition.h"
#include "Conditions/SkillLevel/SkillLevelCondition.h"
#include "Conditions/QuestStageDone/QuestStageDoneCondition.h"
#include "Conditions/PlayerFirstEnterCell/PlayerFirstEnterCellCondition.h"
#include "Conditions/ItemCrafted/ItemCraftedCondition.h"
#include "Conditions/BookRead/BookReadCondition.h"
#include "Conditions/ActorDeath/ActorDeathCondition.h"

Achievement::Achievement(json& jsonData, std::string plugin)
    : achievementName(jsonData["achievementName"].get<std::string>()),
    description(jsonData["description"].get<std::string>()),
    unlocked(false) {  // Initialize joinType and unlocked

    this->plugin = plugin;
    if (jsonData.value("joinType", "OR") == "OR") this->joinType = ConditionsJoinType::OR;
    else this->joinType = ConditionsJoinType::AND;

    this->eventHandler.appendListener("ConditionMet", [this]() {
        this->OnConditionMet();
    });

    for (json condition : jsonData["conditions"]) {
        Condition* a_condition = nullptr;
        std::string type = condition["type"].get<std::string>();
        if (type == "QuestStageDone") {
            QuestStageDoneConditionFactory* questStageDoneConditionFactory = new QuestStageDoneConditionFactory();
            a_condition = questStageDoneConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["questID"].get<std::string>(), condition["stage"].get<int>());
        }
		else if (type == "PlayerLevel") {
			PlayerLevelConditionFactory* playerLevelConditionFactory = new PlayerLevelConditionFactory();
            a_condition = playerLevelConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["level"].get<int>());
		}
        else if (type == "SkillLevel") {
            PlayerSkillLevelConditionFactory* skillLevelConditionFactory = new PlayerSkillLevelConditionFactory();
            a_condition = skillLevelConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["skill"].get<std::string>(), condition["level"].get<int>());
        }
        else if (type == "ItemInInventory") {
            ItemInInventoryConditionFactory* itemInInventoryConditionFactory = new ItemInInventoryConditionFactory();
            a_condition = itemInInventoryConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["itemFormID"].get<std::string>(), condition["quantity"].get<int>());
        }
        else if (type == "LocationDiscovery") {
            LocationDiscoveryConditionFactory* locationDiscoveryConditionFactory = new LocationDiscoveryConditionFactory();
            a_condition = locationDiscoveryConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["locationID"].get<std::string>(), condition["worldspaceID"].get<std::string>());
        }
        else if (type == "DragonSoulAbsorbed") {
            DragonSoulAbsorbedConditionFactory* dragonSoulAbsorbedConditionFactory = new DragonSoulAbsorbedConditionFactory();
            a_condition = dragonSoulAbsorbedConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["quantity"].get<int>());
        }
        else if (type == "PlayerActivation") {
            PlayerActivationConditionFactory* playerActivationConditionFactory = new PlayerActivationConditionFactory();
            a_condition = playerActivationConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["formID"].get<std::string>());
        }
        else if (type == "FirstEnterCell") {
            PlayerFirstEnterCellConditionFactory* playerFirstEnterCellConditionFactory = new PlayerFirstEnterCellConditionFactory();
			a_condition = playerFirstEnterCellConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["cellID"].get<std::string>());
        }
        else if (type == "ItemCrafted") {
			ItemCraftedConditionFactory* itemCraftedConditionFactory = new ItemCraftedConditionFactory();
			a_condition = itemCraftedConditionFactory->createCondition();
			a_condition->SetConditionParameters(condition["itemID"].get<std::string>());
		}
        else if (type == "BookRead"){
            BookReadConditionFactory* bookReadConditionFactory = new BookReadConditionFactory();
            a_condition = bookReadConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["bookID"].get<std::string>());
        }
        else if (type == "ActorDeath") {
            ActorDeathConditionFactory* actorDeathConditionFactory = new ActorDeathConditionFactory();
            a_condition = actorDeathConditionFactory->createCondition();
            a_condition->SetConditionParameters(condition["formID"].get<std::string>());
        }
        else {
            logger::warn("Unknown condition type {} in {}.", type, this->achievementName);
        }
        if(a_condition) conditions.push_back(a_condition);
        conditionMet.push_back(false);
    }
}

void Achievement::EnableListener(void) {
    if(conditions.size() == 0) {
		logger::warn("Achievement {} has no conditions.", this->achievementName);
		return;
	}
	// Enable listener for this achievement
    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->achievementName);
    if (sa.unlocked) {
        this->unlocked = true;
        logger::info("Achievement {} has already been unlocked.", this->achievementName);
        return;
    }
    else {
        if(sa.conditionsMet.size() > 0) this->conditionMet = sa.conditionsMet;
    }

    if (hooked) return;
    int i = 0;
    for (Condition* condition : conditions) {
        if (conditionMet[i]) continue;
        condition->SetEventManager(&eventHandler);
        condition->SetPlugin(this->plugin);
		condition->EnableListener();
	}
    this->hooked = true;
}

void Achievement::OnConditionMet(void) {
    bool allConditionsMet = false;
    int i = 0;
    for (Condition* condition : conditions) {
        if (condition->isMet == true) {
            conditionMet[i] = true;
        }
        i++;
    }

    switch (this->joinType) {
    case ConditionsJoinType::OR:
        allConditionsMet = false;
        for (bool condition : conditionMet) {
            if (condition == true) {
                allConditionsMet = true;
                break;
            }
        }
		break;
    case ConditionsJoinType::AND:
        allConditionsMet = true;
        for (bool condition : conditionMet) {
            if (condition == false) {
                allConditionsMet = false;
                break;
            }
        }
        break;
    }

    if (allConditionsMet) {
        unlocked = true;
        logger::info("Achievement {} unlocked", achievementName);
        if (Settings::GetSingleton()->GetUsePopup()) {
            DisplayEntryWithWait(std::make_tuple(this->achievementName, this->description));
            //Scaleform::AchievementWidget::DisplayEntry(achievementName, description);
        }
    }
    Serializer::GetSingleton()->SerializeAchievementData(this);
}