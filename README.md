
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
