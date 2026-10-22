#include "ConditionFactory.h"

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

Condition* CreateCondition(json& condition, const std::string& plugin, const std::string& groupName, const std::string& achievementName) {
    Condition* a_condition = nullptr;
    std::string type = condition["type"].get<std::string>();
    try {
        if (type == "QuestStageDone") {
            a_condition = new QuestStageDoneCondition();
            a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("operation", ">="), condition["stage"].get<int>());
        }
        else if (type == "PlayerLevel") {
            a_condition = new PlayerLevelCondition();
            a_condition->SetConditionParameters(condition.value("operation", ">="), condition["level"].get<int>());
        }
        else if (type == "SkillLevel") {
            a_condition = new PlayerSkillLevelCondition();
            a_condition->SetConditionParameters(condition["skill"].get<std::string>(), condition.value("operation", ">="), condition["level"].get<int>());
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
            a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("quantity", 1));
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
            a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("quantity", 1));
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
            a_condition->SetConditionParameters(condition["formID"].get<std::string>(), condition.value("operation", ">="), condition["value"].get<float>());
        }
        else if (type == "CustomSkillLevel") {
            a_condition = new CustomSkillLevelCondition();
            a_condition->SetConditionParameters(condition["skill"].get<std::string>(), condition["level"].get<float>());
        }
        else if (type == "QueryStatValue") {
            a_condition = new QueryStatValueCondition();
            a_condition->SetConditionParameters(condition["stat"].get<std::string>(), condition.value("operation", ">="), condition["value"].get<float>());
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
                        logger::error("Skipping condition in achievement {}.", achievementName);
                        return nullptr;
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
            a_condition->SetConditionParameters(condition["achievement"].get<std::string>(), condition.value("group", groupName));
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
            logger::warn("[{}.json] Unknown condition type {} in {}.", groupName, type, achievementName);
        }
    } catch (std::exception& e) {
			logger::error("Error creating condition: {}", e.what());
        logger::error("Skipping condition in achievement {}.", achievementName);
        return nullptr;
		}
    bool negate = condition.value("negate", false);
    if (a_condition && (negate || condition.value("live", false))) {
        if (a_condition->SupportsLive()) {
            a_condition->live = true;
            a_condition->negate = negate;
        } else {
            logger::warn("[{}.json] Condition type {} in {} does not support \"live\" or \"negate\". Skipping condition.", groupName, type, achievementName);
            a_condition = nullptr;
        }
    }
    if (a_condition) {
        if (condition.value("pluginOverride", "") != "") a_condition->SetPlugin(condition["pluginOverride"].get<std::string>());
        else a_condition->SetPlugin(plugin);
        a_condition->Localize(groupName);
        a_condition->push_back(condition.value("onUnlock", json::array()));
    }
    return a_condition;
}
