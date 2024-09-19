#include "Achievement.h"

#include <string>
#include <memory>
#include "ConditionsJoinType.h"
#include "settings.h"
#include "Serializer.h"
#include "Utility.h"
#include <fmt/core.h>
#include "AchievementWidget.h"
#include "../include/ConsoleUtilSSE.h"
#include "LocalizationManager.h"

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
#include "Conditions/QueryStatValue/QueryStatValueCondition.h"
#include "Conditions/ActorDeath/ActorDeathCondition.h"
#include "Conditions/GlobalVariableState/GlobalVariableStateCondition.h"
#include "Conditions/BaseActorDeath/BaseActorDeathCondition.h"
#include "Conditions/SpellLearned/SpellLearnedCondition.h"
#include "Conditions/ShoutLearned/ShoutLearnedCondition.h"
#include "Conditions/DungeonCleared/DungeonClearedCondition.h"
#include "Conditions/QuestObjectiveDone/QuestObjectiveDoneCondition.h"
#include "Conditions/AchievementUnlocked/AchievementUnlockedCondition.h"
#include "AchievementManager.h"

Achievement::Achievement(json& jsonData, std::string plugin, std::string groupName)
    : Runnable(jsonData.value("onUnlock", json::array())), achievementName(jsonData["achievementName"].get<std::string>()),
    description(jsonData["description"].get<std::string>()),
    unlocked(false) {  // Initialize joinType and unlocked

    this->groupName = groupName;
    this->plugin = plugin;
    if (jsonData.value("joinType", "OR") == "OR") this->joinType = ConditionsJoinType::OR;
    else this->joinType = ConditionsJoinType::AND;
    
    this->showPopup = jsonData.value("showPopup", true);
    this->hidden = jsonData.value("hideDescription", false);
    this->notificationSound = jsonData.value("notificationSound", "");

    this->eventHandler.appendListener("ConditionMet", [this]() {
        this->OnConditionMet();
    });
    this->eventHandler.appendListener("SerializationRequested", [this]() {
        this->OnSerializationRequested();
    });

    this->Localize();

    for (json condition : jsonData["conditions"]) {
        Condition* a_condition = nullptr;
        std::string type = condition["type"].get<std::string>();
        try {
            if (type == "QuestStageDone") {
                QuestStageDoneConditionFactory* questStageDoneConditionFactory = new QuestStageDoneConditionFactory();
                a_condition = questStageDoneConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("operation", ">="), condition["stage"].get<int>());
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
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["quantity"].get<int>());
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
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "BookRead") {
                BookReadConditionFactory* bookReadConditionFactory = new BookReadConditionFactory();
                a_condition = bookReadConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["bookID"].get<std::string>());
            }
            else if (type == "ActorDeath") {
                ActorDeathConditionFactory* actorDeathConditionFactory = new ActorDeathConditionFactory();
                a_condition = actorDeathConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "GlobalVariableState") {
                GlobalVariableStateConditionFactory* globalVariableStateConditionFactory = new GlobalVariableStateConditionFactory();
                a_condition = globalVariableStateConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["value"].get<float>());
            }
            else if (type == "QueryStatValue") {
                QueryStatValueConditionFactory* queryStatValueConditionFactory = new QueryStatValueConditionFactory();
                a_condition = queryStatValueConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["stat"].get<std::string>(), condition["value"].get<float>());
            }
            else if (type == "BaseActorDeath") {
                BaseActorDeathConditionFactory* baseActorDeathConditionFactory = new BaseActorDeathConditionFactory();
                a_condition = baseActorDeathConditionFactory->createCondition();
                std::string id = condition.value("formID", "");
                if (id == "") id = condition.value("name", "");
                a_condition->SetConditionParameters(id, condition.value("quantity", 1));
            }
            else if (type == "SpellLearned") {
                SpellLearnedConditionFactory* spellLearnedConditionFactory = new SpellLearnedConditionFactory();
                a_condition = spellLearnedConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "LocationCleared") {
                DungeonClearedConditionFactory* dungeonClearedConditionFactory = new DungeonClearedConditionFactory();
                a_condition = dungeonClearedConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "ShoutLearned") {
                ShoutLearnedConditionFactory* shoutLearnedConditionFactory = new ShoutLearnedConditionFactory();
                a_condition = shoutLearnedConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["words"].get<int>());
            }
            else if (type == "QuestObjectiveDone") {
                QuestObjectiveDoneConditionFactory* questObjectiveDoneConditionFactory = new QuestObjectiveDoneConditionFactory();
                a_condition = questObjectiveDoneConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["objective"].get<int>());
            }
            else if (type == "AchievementUnlocked") {
                AchievementUnlockedConditionFactory* achievementUnlockedConditionFactory = new AchievementUnlockedConditionFactory();
                a_condition = achievementUnlockedConditionFactory->createCondition();
                a_condition->SetConditionParameters(condition["achievement"].get<std::string>(), condition.value("group", this->groupName));
            }
            else {
                logger::warn("Unknown condition type {} in {}.", type, this->achievementName);
            }
        } catch (std::exception& e) {
			logger::error("Error in Achievement constructor: {}", e.what());
            logger::error("Skipping condition in achievement {}.", this->achievementName);
            continue;
		}
        if (a_condition) {
            if (condition.value("pluginOverride", "") != "") a_condition->SetPlugin(condition["pluginOverride"].get<std::string>());
            else a_condition->SetPlugin(this->plugin);
            a_condition->Localize(this->groupName);
            a_condition->push_back(condition.value("onUnlock", json::array()));
            conditions.push_back(a_condition);
        };
        conditionMet.push_back(false);
    }
    try {
        for (auto& func : jsonData["onUnlock"]) {
            if (func["type"].get<std::string>() == "command") {
                this->rewardCommandList.push_back(func["command"].get<std::string>());
            }
        }
    }catch(std::exception& e) {
		logger::error("Error in Achievement constructor: {}", e.what());
	}

}

void Achievement::EnableListener(void) {
    if(conditions.size() == 0) {
		logger::warn("Achievement {} has no conditions.", this->achievementName);
		return;
	}
	// Enable listener for this achievement
    this->unlocked = false;
    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->achievementName);
    if (sa.unlocked) {
        this->unlocked = true;
        logger::info("Achievement {} has already been unlocked.", this->achievementName);
        return;
    }

    if (hooked) return;
    int i = 0;
    for (Condition* condition : conditions) {
        if (!CheckIfModIsLoaded(condition->plugin)) {
            logger::warn("Plugin {} not loaded. Skipping condition.", condition->plugin);
            continue;
        }
        if (sa.conditionsState.size() > 0 && (this->conditionMet[i] = condition->Deserialize(sa.conditionsState[i]))) {
            condition->isMet = true;
            // Conditions is already fulfilled
            return;
        };
        condition->SetEventManager(&eventHandler);
		condition->EnableListener();
	}
    this->hooked = true;
}

void Achievement::OnSerializationRequested() {
    logger::info("Serialization requested.");
    Serializer::GetSingleton()->SerializeAchievementData(this);
    AchievementManager::GetSingleton()->UpdateCache();
}

void Achievement::OnConditionMet(void) {
    if (this->unlocked) return;
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
        AchievementUnlockedEvent e;
        e.achievement = this;
        e.achievementGroup = this->groupName;
        AchievementManager::GetSingleton()->Dispatch(&e);
        if (this->showPopup && Settings::GetSingleton()->GetUsePopup()) {
            DisplayEntryWithWait(std::make_tuple(this->achievementName, this->description, this->notificationSound));
        }
        this->RunAll();

  //      for(std::string command : rewardCommandList) {
  //          Papyrus::ConsoleUtil::ExecuteCommand(NULL, command);
		//}
    }
    this->eventHandler.dispatch("SerializationRequested");
    //Serializer::GetSingleton()->SerializeAchievementData(this);
}

std::vector<int> Achievement::GetConditionsState(void) {
    std::vector<int> v;
    for (Condition* condition : this->conditions) {
        v.push_back(condition->Serialize());
    }
    return v;
}

void Achievement::Localize() {
    if (achievementName[0] == '$') 
        this->achievementName = LocalizationManager::GetSingleton()->GetLocalizedText(this->groupName, LocalizationManager::GetSingleton()->CurrentLocale(), achievementName);
    if (description[0] == '$') 
        this->description = LocalizationManager::GetSingleton()->GetLocalizedText(this->groupName, LocalizationManager::GetSingleton()->CurrentLocale(), description);
}

void Achievement::ToGFxValue(RE::GFxValue* gfxValue) {
    // Create GFxValues for each member
    RE::GFxValue nameVal, descriptionVal, unlockDatetimeVal;

    nameVal.SetString(this->achievementName.c_str());               // GFxValue for name
    descriptionVal.SetString(this->description.c_str()); // GFxValue for description
    unlockDatetimeVal.SetNumber(static_cast<double>(Serializer::GetSingleton()->DeserializeAchievementData(this->achievementName).unlockDatetime)); // GFxValue for unlockDatetime

    // Add these values to the gfxValue object
    gfxValue->SetMember("name", &nameVal);
    gfxValue->SetMember("description", &descriptionVal);
    gfxValue->SetMember("unlockDatetime", &unlockDatetimeVal);
}

json Achievement::ToJson() {
    json data = json::object();

    std::string desc = this->description;
    if (!this->unlocked && this->hidden && !Settings::GetSingleton()->GetShowHidden()) desc = "Hidden Description.";

    if (Settings::GetSingleton()->GetGlobal()) {
        SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData_GLOBAL(this->achievementName);
        data["AchievementName"] = this->achievementName;
        data["Description"] = desc;
        data["UnlockDatetime"] = sa.unlockDatetime;
        data["Unlocked"] = this->unlocked;
    }
    else {
        SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->achievementName);
        data["AchievementName"] = this->achievementName;
        data["Description"] = desc;
        data["UnlockDatetime"] = sa.unlockDatetime;
        data["Unlocked"] = sa.unlocked;
    }
    return data;
}