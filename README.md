
# Achievement Injector

This skyrim mod allows modders to create custom in-game achievements that can be unlocked by the player. Releases and more informations about the mod can be found on nexusmods.
If you're developing your addon for this mod and you need help, feel free to join the discord in the nexusmods page.

# DESCRIPTION

## INTRODUCTION
This mod has been inspired by the last few years of gameplay mod development in skyrim and the fact that after 8 years and 800 hours in the game I only have something like 15 achievements.

## FEATURES
This framework introduces a new menu which allows you to check all the achievements registered, which you have unlocked and which you haven't unlocked. Moreover, it featuers a popup widget that will show up whenever you unlock an achievement, similarly to how steam, xbox and ps show it.
﻿

Via the MCM Settings or ini file you will be able to choose whether you want a popup to appear (for immersion puposes) upon achievement unlock, whether you want to disable the popup sound and if you do use a sound, you will be able to select between some pre-determined sounds to play - similarly to how you can select ringtones in your phone, with the default being the skill levelup sound as I found it fitting.

You can also choose whether to use per-character achievements or global achievements. In the first case the mod will generate a file for each character you have, while in the second case, the achievements will be shared between characters. 
NOTE: if you have multiple characters with the same name (firstly: why would you?) the framework will use the same json file for the achievements, which means that you will have the same achievements unlocked for both characters.

The framework is also somewhat able to check whether you have completed an achievement previously to its installation, although not for all achievements.

## REQUIREMENTS
This mod has very few requirements:

[SKSE64](https://skse.silverlock.org)
[Address Library for SKSE Plugins](https://www.nexusmods.com/skyrimspecialedition/mods/32444)

While not a requirement, I still recommend Achievements Mods Enabler if you want the base game achievements to be also counted by steam, and in case you want to reset your steam achievements to reacquire them, [Steam Achievement Manager](https://github.com/gibbed/SteamAchievementManager/releases/tag/7.0.25) allows you to do just that with a simple interface.

## FURTHER INFORMATIONS
If you require further informations about this mod, please visit the nexus page at [https://www.nexusmods.com/skyrimspecialedition/mods/126220](https://www.nexusmods.com/skyrimspecialedition/mods/126220?tab=description).

# DEVELOPMENT

## CREATING ACHIEVEMENTS
If you want to add achievements for your own mod you don't need to write a single line of C++: all you have to do is drop a json file in `Data/SKSE/Plugins/AchievementsData/` (the old `Data/AchievementsData/` folder still works too). The name of the file is the id of your group, and if you want a custom icon for it you can add a dds with the same name in the `Icons` folder, otherwise the default one will be used.

```json
{
    "groupName": "My Mod",
    "plugin": "MyMod.esp",
    "achievements": [
        {
            "achievementName": "$NAME_Hero",
            "description": "$DESC_Hero",
            "icon": "ACH_Hero.dds",
            "joinType": "AND",
            "conditions": [
                { "type": "QuestStageDone", "formID": "00352A", "stage": 200 },
                { "type": "PlayerLevel", "level": 20 }
            ],
            "onUnlock": [
                { "type": "command", "command": "player.additem f 100" }
            ]
        }
    ]
}
```

Names and descriptions can either be written directly in the json or, if they start with `$`, they will be looked up in `Localizations/<FileName>_<LANG>.txt`, which is a simple tab separated file with the key on the left and the text on the right. The formIDs are hex strings relative to the plugin you set for the group, so you don't have to worry about load order.

By default an achievement unlocks as soon as one of its conditions is met; if you want all of them to be required set `joinType` to `AND`. You can also hide an achievement from the menu with `showInMenu`, hide its description until it's unlocked with `hideDescription`, disable its popup with `showPopup`, give it its own sound with `notificationSound` and run console commands or papyrus functions when it unlocks with `onUnlock`. Papyrus functions called this way must be `Global`.

The conditions currently available are AchievementUnlocked, ActorDeath, BaseActorDeath, BookRead, DragonSoulAbsorbed, FirstEnterCell, GlobalVariableState, HasPerk, HasPerks, ItemCrafted, ItemInInventory, LocationCleared, LocationDiscovery, ObjectState, PapyrusBinding, PlayerActivation, PlayerCrime, PlayerLevel, QueryStatValue, QuestObjectiveDone, QuestStageDone, ShoutLearned, SkillLevel, SpellLearned and WorldspaceDiscovery. I haven't documented the fields of each one here, so the best reference is the json files of the vanilla achievements that ship with the mod, which you can find in `Skyrim/Data/SKSE/Plugins/AchievementsData/`.

## PAPYRUS AND CONSOLE
In case none of the conditions do what you need, you can unlock an achievement directly from your own scripts:

```papyrus
Scriptname AchievementInjectorScripts Hidden

Int[] Function GetVersion() Global Native
Function UnlockAchievement(String name, String group) Global Native
```

If you have Custom Console installed, the same function is available in the console as `ai uach -n <achievementName> -g <group>`, which is quite handy for testing.

## BUILDING
The plugin is built with [xmake](https://xmake.io) and needs a C++23 compiler (MSVC) and the CommonLibSSE-NG submodule, so remember to clone the repository with its submodules or xmake will complain that it can't find it.

```
git submodule update --init --recursive
xmake f -m release
xmake
```

The source of the plugin is in `src`, with one folder for each condition in `src/Conditions`. `Skyrim/Data` mirrors the Data folder of the game and is what ends up in the release, while `flash` contains the sources of the menu and of the popup widget, which have to be compiled by hand.
