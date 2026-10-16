#include "Achievement.h"

#include <string>
#include <memory>
#include "ConditionsJoinType.h"
#include "CommonFunctions.h"
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
#include "Conditions/PapyrusBinding/PapyrusBindingCondition.h"
#include "Conditions/PlayerActivation/PlayerActivationCondition.h"
#include "Conditions/PlayerLevel/PlayerLevelCondition.h"
#include "Conditions/SkillLevel/SkillLevelCondition.h"
#include "Conditions/SpellCast/SpellCastCondition.h"
#include "Conditions/MagicEffectApplied/MagicEffectAppliedCondition.h"
#include "Conditions/FactionRank/FactionRankCondition.h"
#include "Conditions/ItemEquipped/ItemEquippedCondition.h"
#include "Conditions/QuestStageDone/QuestStageDoneCondition.h"
#include "Conditions/PlayerFirstEnterCell/PlayerFirstEnterCellCondition.h"
#include "Conditions/ItemCrafted/ItemCraftedCondition.h"
#include "Conditions/BookRead/BookReadCondition.h"
#include "Conditions/HasPerk/HasPerkCondition.h"
#include "Conditions/HasPerks/HasPerksCondition.h"
#include "Conditions/QueryStatValue/QueryStatValueCondition.h"
#include "Conditions/PapyrusVariable/PapyrusVariableCondition.h"
#include "Conditions/ActorDeath/ActorDeathCondition.h"
#include "Conditions/GlobalVariableState/GlobalVariableStateCondition.h"
#include "Conditions/CustomSkillLevel/CustomSkillLevelCondition.h"
#include "Conditions/BaseActorDeath/BaseActorDeathCondition.h"
#include "Conditions/SpellLearned/SpellLearnedCondition.h"
#include "Conditions/ShoutLearned/ShoutLearnedCondition.h"
#include "Conditions/DungeonCleared/DungeonClearedCondition.h"
#include "Conditions/QuestObjectiveDone/QuestObjectiveDoneCondition.h"
#include "Conditions/AchievementUnlocked/AchievementUnlockedCondition.h"
#include "Conditions/ObjectState/ObjectStateCondition.h"
#include "Conditions/PlayerCrime/PlayerCrimeCondition.h"
#include "Conditions/WorldspaceDiscovery/WorldspaceDiscoveryCondition.h"
#include "AchievementManager.h"

static bool checkIcon(std::string group, std::string name) {
    if (name == "")
        return false;
    if (!std::filesystem::exists("Data\\SKSE\\Plugins\\AchievementsData\\Icons\\" + group + "\\" + name)) {
        logger::warn("Icon {} from {} was declared but doesn't exist at path", name, group, "Data\\SKSE\\Plugins\\AchievementsData\\Icons\\" + group + "\\");
        return false;
    }
    return true;
}

Achievement::Achievement(json& jsonData, std::string plugin, std::string groupName)
    : Runnable(jsonData.value("onUnlock", json::array())), achievementName(jsonData["achievementName"].get<std::string>()),
    description(jsonData["description"].get<std::string>()),
    unlocked(false) {  // Initialize joinType and unlocked

    this->groupName = groupName;
    this->plugin = plugin;
    if (jsonData.value("joinType", "OR") == "OR") this->joinType = ConditionsJoinType::OR;
    else this->joinType = ConditionsJoinType::AND;
    
    this->showPopup = jsonData.value("showPopup", true);
    this->showInMenu = jsonData.value("showInMenu", true);
    this->hidden = jsonData.value("hideDescription", false);
    this->notificationSound = jsonData.value("notificationSound", "");
    this->icon = jsonData.value("icon", "");
    // Resolved once: the menu list is rebuilt often and must not hit the disk per achievement
    if (checkIcon(groupName, this->icon)) this->iconPath = "..\\SKSE\\Plugins\\AchievementsData\\Icons\\" + groupName + "\\" + this->icon;

    this->eventHandler.appendListener("ConditionMet", [this]() {
        this->OnConditionMet();
    });
    this->eventHandler.appendListener("SerializationRequested", [this]() {
        this->OnSerializationRequested();
    });

    this->Localize();
    logger::debug("Analyzing achievement {}.", this->achievementName);

    for (json condition : jsonData["conditions"]) {
        Condition* a_condition = nullptr;
        std::string type = condition["type"].get<std::string>();
        try {
            if (type == "QuestStageDone") {
                a_condition = new QuestStageDoneCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("operation", ">="), condition["stage"].get<int>());
            }
            else if (type == "PlayerLevel") {
                a_condition = new PlayerLevelCondition();
                a_condition->SetConditionParameters(condition["level"].get<int>());
            }
            else if (type == "SkillLevel") {
                a_condition = new PlayerSkillLevelCondition();
                a_condition->SetConditionParameters(condition["skill"].get<std::string>(), condition["level"].get<int>());
            }
            else if (type == "ItemInInventory") {
                a_condition = new ItemInInventoryCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["quantity"].get<int>());
            }
            else if (type == "LocationDiscovery") {
                a_condition = new LocationDiscoveryCondition();
                std::string locID = condition.value("locationID", "");
                std::string formID = condition.value("formID", "");
                std::string worldspaceID = condition.value("worldspaceID", "");
                a_condition->SetConditionParameters(locID, worldspaceID, formID);
            }
            else if (type == "DragonSoulAbsorbed") {
                a_condition = new DragonSoulAbsorbedCondition();
                a_condition->SetConditionParameters(condition["quantity"].get<int>());
            }
            else if (type == "PlayerActivation") {
                a_condition = new PlayerActivationCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "SpellCast") {
                a_condition = new SpellCastCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("quantity", 1));
            }
            else if (type == "MagicEffectApplied") {
                a_condition = new MagicEffectAppliedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("quantity", 1));
            }
            else if (type == "FactionRank") {
                a_condition = new FactionRankCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("rank", 0));
            }
            else if (type == "ItemEquipped") {
                a_condition = new ItemEquippedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "FirstEnterCell") {
                a_condition = new PlayerFirstEnterCellCondition();
                a_condition->SetConditionParameters(condition["cellID"].get<std::string>());
            }
            else if (type == "ItemCrafted") {
                a_condition = new ItemCraftedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "BookRead") {
                a_condition = new BookReadCondition();
                std::string identifier = condition.value("formID", "");
                if (identifier == "")
                    identifier = condition["bookID"].get<std::string>();
                a_condition->SetConditionParameters(identifier);
            }
            else if (type == "ActorDeath") {
                a_condition = new ActorDeathCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "GlobalVariableState") {
                a_condition = new GlobalVariableStateCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["value"].get<float>());
            }
            else if (type == "CustomSkillLevel") {
                a_condition = new CustomSkillLevelCondition();
                a_condition->SetConditionParameters(condition["skill"].get<std::string>(), condition["level"].get<float>());
            }
            else if (type == "QueryStatValue") {
                a_condition = new QueryStatValueCondition();
                a_condition->SetConditionParameters(condition["stat"].get<std::string>(), condition["value"].get<float>());
            }
            else if (type == "PapyrusVariable") {
                auto pv = new PapyrusVariableCondition();
                a_condition = pv;
                pv->SetParameters(condition["formID"].get<std::string>(), condition["script"].get<std::string>(),
                                  condition["variable"].get<std::string>(), condition["value"].get<int>());
            }
            else if (type == "BaseActorDeath") {
                a_condition = new BaseActorDeathCondition();
                std::string id = condition.value("formID", "");
                std::string editorid = condition.value("editorID", "");
                if (id == "") {
                    id = condition.value("name", "");
                    if (editorid != "")
                    {
                        if (GetModuleHandleA("po3_Tweaks") == nullptr) {
                            logger::error("PO3 Tweaks not loaded. Cannot use editorID for condition.");
                            logger::error("Skipping condition in achievement {}.", this->achievementName);
                            continue;
                        }
                        id = editorid;
                        static_cast<BaseActorDeathCondition*>(a_condition)->SetEditorID(true);
                    }
                        
                }
                
                a_condition->SetConditionParameters(id, condition.value("quantity", 1));
            }
            else if (type == "SpellLearned") {
                a_condition = new SpellLearnedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "LocationCleared") {
                a_condition = new DungeonClearedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            }
            else if (type == "ShoutLearned") {
                a_condition = new ShoutLearnedCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["words"].get<int>());
            }
            else if (type == "QuestObjectiveDone") {
                a_condition = new QuestObjectiveDoneCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["objective"].get<int>());
            }
            else if (type == "AchievementUnlocked") {
                a_condition = new AchievementUnlockedCondition();
                a_condition->SetConditionParameters(condition["achievement"].get<std::string>(), condition.value("group", this->groupName));
            } 
            else if (type == "ObjectState") {
                a_condition = new ObjectStateCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition["enabled"].get<bool>());
            } else if (type == "PapyrusBinding") {
                a_condition = new PapyrusBindingCondition();
            } else if (type == "PlayerCrime") {
                a_condition = new PlayerCrimeCondition();
                std::vector<std::string> factions;
                for (auto& factionID : condition["factions"]) {
                    factions.push_back(factionID.get<std::string>());
                }
                a_condition->SetConditionParameters(factions, condition["threshold"].get<int>());
            } else if (type == "WorldspaceDiscovery") {
                a_condition = new WorldspaceDiscoveryCondition();
                a_condition->SetConditionParameters(condition["worldspaceID"].get<std::string>(), condition["requiredCount"].get<int>());
            } else if (type == "HasPerk") {
                a_condition = new HasPerkCondition();
                a_condition->SetConditionParameters(condition["formID"].get<std::string>());
            } else if (type == "HasPerks") {
                a_condition = new HasPerksCondition();
                std::vector<std::string> perks;
                for (auto& perkID : condition["perks"]) {
                    perks.push_back(perkID.get<std::string>());
                }
                a_condition->SetConditionParameters(perks, condition["threshold"].get<int>());
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
        if (a_condition) conditionMet.push_back(false);
    }
}

void Achievement::ForceUnlock() {
    for (Condition* condition: conditions) {
        condition->isMet = true;
    }
    this->eventHandler.dispatch("ConditionMet");
}

void Achievement::EnableListener(void) {
    if(conditions.size() == 0) {
		logger::warn("Achievement {} has no conditions.", this->achievementName);
	}
    // Runs again on a character switch: drop the previous character's in-memory progress
    this->unlocked = false;
    conditionMet.assign(conditionMet.size(), false);
    for (Condition* condition : conditions) {
        condition->Deserialize(0);
        condition->isMet = false;
    }
    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->groupName, this->achievementName);
    if (sa.unlocked) {
        this->unlocked = true;
        logger::info("Achievement {} has already been unlocked.", this->achievementName);
        // Sinks hooked for a previous character may still be registered; mark them spent
        for (Condition* condition : conditions) condition->isMet = true;
        return;
    }

    for (size_t i = 0; i < conditions.size(); i++) {
        Condition* condition = conditions[i];
        if (!CheckIfModIsLoaded(condition->plugin)) {
            logger::warn("Plugin {} not loaded. Skipping condition.", condition->plugin);
            continue;
        }
        if (i < sa.conditionsState.size() && condition->Deserialize(sa.conditionsState[i])) {
            // Already fulfilled: nothing to listen for, but the other conditions still need hooking
            condition->isMet = true;
            this->conditionMet[i] = true;
            continue;
        };
        condition->SetEventManager(&eventHandler);
		condition->EnableListener();
	}
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

    // Zero conditions: only ForceUnlock dispatches here
    if (allConditionsMet || conditions.empty()) {
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

std::string Achievement::ToString() {
    std::string output = "";

    std::string desc = this->description;
    if (!this->unlocked && this->hidden && !Settings::GetSingleton()->GetShowHidden()) {
        desc = "$ACH_HIDDEN";
        // The menu shows this text untranslated; desc keeps the key if the lookup fails
        SKSE::Translation::Translate("$ACH_HIDDEN", desc);
    }

    // TODO convert \n to something else

    SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->groupName, this->achievementName);
    output =
        this->groupName + "||" + this->achievementName + "||" + replaceAll(desc, "\n", " ") + "||" +
        std::to_string(sa.unlocked ? sa.unlockDatetime : -1) + "||" + this->iconPath;
    return output;
}