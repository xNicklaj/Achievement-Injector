# Wiki / doc fixes for Achievement Injector

_Verified against the code, 2026-10-20. Split out of HANDOVER.md._

Releases: latest tag is **v1.4.0** (2026-10-17). Everything on `main` after it is **unreleased (1.4.1)**.

**Already fixed**
- Localization path: now `Data/SKSE/Plugins/AchievementsData/Localizations`.
- Papyrus API name in Advanced Usage: `AchievementInjectorScripts` (matches `AchievementInjectorScripts.psc`).

**Still to fix**
- **Paths:** per-achievement icon path in Advanced Usage is missing `Plugins`; Nexus "For mod authors" still says `Data/AchievementInjector/`.
- **Changelog 1.1 entry** still says `AchievementInjectorScript`.
- **`papyrus` onUnlock "doesn't work yet":** drop it. Read on achievements and on conditions; since v1.3.0 `Runnable.cpp` uses `DispatchStaticCall` (v1.2.0 used `DispatchMethodCall`), so the 1.3.0 fix claim is true. Document that the function must be `Global`.
- **Quantities:**
  - `"quantity": "10"` is a real bug: values are read as `int`, so nlohmann/json throws on a string. Use `10`.
  - "As of 1.3.1" doesn't exist. `SpellCast` / `MagicEffectApplied` / `BaseActorDeath` quantities shipped in **1.4.0**; optional quantity on `PlayerActivation` / `ItemCrafted` is commit `1036c9a` on `main`, **unreleased (1.4.1)**. In v1.4.0 those two ignore `quantity`.
  - Required vs default: **required** on `ItemInInventory` and `DragonSoulAbsorbed`; **defaults to 1** on `PlayerActivation`, `ItemCrafted`, `SpellCast`, `MagicEffectApplied`, `BaseActorDeath`.
- **Version labels:** `operation` on `GlobalVariableState` / `QueryStatValue` is commit `c532c67`, after v1.4.0, so "1.4.1 upcoming" is correct; Getting Started ("as of 1.3.0") documents it as current. Label consistently, or mark unreleased.
- **Examples page:**
  - Iron Dagger: `01397E` is correct; `0896F5` in Example 1 is wrong.
  - Example 3's `"OP"` is never read, so `EQ` silently behaves as `>=`. Use `operation`.
  - Trailing commas in Examples 2 and 4 make them invalid JSON.
- **Empty JSON schema section:** document root fields, achievement fields (incl. `onUnlock`) and condition fields. The custom unlock sound is the per-achievement **`notificationSound`** key (`Achievement.cpp:71`), currently undocumented; the MCM `bOverrideNotificationSound` setting replaces it with the player's chosen sound.
- **`PlayerCrime`:** the changelog wording ("counts crimes") is stale; the code compares `GetCrimeGoldValue(faction)` to the threshold per faction. Worth documenting that any tracked stat containing "Bounty" only triggers a re-check.

**Localization file names (undocumented)**
- The locale in `<Group>_<LOCALE>.txt` is the first two letters of the game's `sLanguage`, uppercased (`LocalizationManager.cpp`), not an ISO code. Skyrim's nine languages map to `EN FR GE IT SP PO RU JA CH` (ENGLISH, FRENCH, GERMAN, ITALIAN, SPANISH, POLISH, RUSSIAN, JAPANESE, CHINESE). `DE`, `ES`, `PL`, `ZH` and `CN` never match. Document the table, or consider mapping ISO codes in the DLL.
- Lookup falls back to `EN`, then to the raw `$key`. Files are UTF-8 or ANSI; a BOM hides the first key. Only lines starting with `$` and containing a tab are read; repeated tabs after the key are skipped.

**`AchievementUnlocked` and localized names (undocumented)**
- `AchievementUnlockedCondition` compares `achievement` with the target's final name as plain text, and the condition itself is never localized (`Condition::Localize` does nothing for it). To reference an achievement whose `achievementName` is a `$key`, the condition must hold the localized text for the player's language, so it cannot work across languages. Saved progress is keyed by the same localized text. Worth documenting, or localizing the reference in the DLL.
- The per-achievement `icon` value includes the extension (`"ACH_Awakening.dds"`) and is looked up in `Icons/<Group>/` where `<Group>` is the JSON file name.
