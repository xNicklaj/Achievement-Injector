import { z } from "zod";
import {
  BASELINE_VERSION,
  achievementRef,
  bool,
  describeFields,
  editorId,
  enumOf,
  float,
  formId,
  formIdList,
  int,
  localized,
  pluginFile,
  str,
} from "./fields";

// Built from src/Achievement.cpp (constructor) and src/Conditions/*, not from the wiki.
// Required = the DLL does `condition["x"].get<T>()` (throws -> condition skipped).
// Optional = `condition.value("x", default)`; the default goes in `default` meta, never in parsing.

export const EditorNode = z.object({ id: z.string().min(1), x: z.number(), y: z.number() });
const XY = z.object({ x: z.number(), y: z.number() });
/** Positions of the action nodes after the node, in chain order (achievements and conditions both carry an `onUnlock` chain). */
export const ChainEditor = EditorNode.extend({ chain: z.array(XY).optional(), mods: z.array(EditorNode.extend({ kind: z.string() })).optional() });

/** `onUnlock` entries (Runnable.cpp). Papyrus targets a Global function: DispatchStaticCall, no form to bind. */
export const OnUnlockAction = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("command"), command: z.string().min(1) }),
  z.looseObject({ type: z.literal("papyrus"), script: z.string().min(1), function: z.string().min(1) }),
]);

// Operators CompareValues knows; anything else never matches. `<`, `<=`, `!=` (and aliases) came in 1.4.1 (enum options carry no per-option `since`).
const operation = (o: { since?: string } = {}) =>
  enumOf([">=", "GT", "==", "EQ", "<", "LT", "<=", "LE", "!=", "NE"], { optional: true, default: ">=", ...o });
// Condition::SupportsLive() types. The editor sets `live`/`negate` through the Live and Negate nodes, never as fields; the DLL skips any other type that has them.
export const LIVE_TYPES: ReadonlySet<string> = new Set([
  "QuestStageDone", "PlayerLevel", "SkillLevel", "ItemInInventory", "FactionRank", "ItemEquipped", "GlobalVariableState",
  "QueryStatValue", "SpellLearned", "ShoutLearned", "QuestObjectiveDone", "ObjectState", "HasPerk", "HasPerks",
]);
const quantity = int;

// StringToActorValue (CommonFunctions.cpp), matched case-insensitively. Note "marksman", not "archery".
export const SKILLS = [
  "alchemy", "alteration", "marksman", "block", "conjuration", "destruction", "enchanting",
  "heavyarmor", "illusion", "lightarmor", "lockpicking", "onehanded", "pickpocket",
  "restoration", "smithing", "sneak", "speechcraft", "twohanded",
] as const;
const skill = () =>
  z
    .string()
    .refine((v) => (SKILLS as readonly string[]).includes(v.toLowerCase()), "Unknown skill")
    .meta({ widget: "enum", since: BASELINE_VERSION, options: SKILLS });

// Shown behind the node's ? button. Written from src/Conditions/*: what triggers the check and what the fields mean.
const DESCRIPTIONS: Record<string, string> = {
  QuestStageDone: "Met when the quest's current stage compares true against the stage (>= by default).",
  PlayerLevel: "Met when the player's level compares true against the level, checked on each level up.",
  SkillLevel: "Met when the skill's level compares true against the level, checked on each skill increase.",
  ItemInInventory: "Met when the player holds at least this quantity of the item, checked whenever an item moves into their inventory.",
  LocationDiscovery: "Met when the player discovers a map marker, by reference or by name, optionally only in one worldspace.",
  DragonSoulAbsorbed: "Met when the player has absorbed at least this many dragon souls.",
  PlayerActivation: "Met when the player activates the reference this many times.",
  SpellCast: "Met when the player casts the spell this many times.",
  MagicEffectApplied: "Met when the magic effect is applied to the player this many times.",
  FactionRank: "Met when the player's rank in the faction is at least the rank. Rank 0 means any member. Checked when a menu closes.",
  ItemEquipped: "Met when the player equips the item. Also met at once if it is already worn.",
  FirstEnterCell: "Met the first time the player enters the cell.",
  ItemCrafted: "Met when the player crafts the item this many times.",
  BookRead: "Met when the player reads the book, matched by form ID or, failing that, by its displayed name.",
  ActorDeath: "Met when this exact placed actor (reference) dies.",
  GlobalVariableState: "Met when the global variable's value compares true against the value (>= by default).",
  CustomSkillLevel: "Met when a Custom Skills Framework skill reaches the level. Needs that mod.",
  QueryStatValue: "Met when a tracked stat from the Stats menu compares true against the value (>= by default).",
  PapyrusVariable: "Met when a Papyrus script variable on the reference equals the value. The script must be attached to the reference. Checked when a menu closes.",
  BaseActorDeath: "Met when this many actors of the base type die, matched by form ID, editor ID (needs powerofthree's Tweaks) or name.",
  SpellLearned: "Met when the player knows the spell.",
  LocationCleared: "Met when the location is marked cleared, checked as the Dungeons Cleared stat rises.",
  ShoutLearned: "Met when the player has unlocked at least this many words of the shout.",
  QuestObjectiveDone: "Met when the quest objective is completed.",
  AchievementUnlocked: "Met when another achievement unlocks, in this group or another.",
  ObjectState: "Met when the reference is enabled or disabled, as chosen.",
  PlayerCrime: "Met when the player's bounty is at least the threshold in every listed faction.",
  WorldspaceDiscovery: "Met when the player has discovered this many locations in the worldspace.",
  HasPerk: "Met when the player has the perk. Checked when a menu closes.",
  HasPerks: "Met when the player has at least this many of the listed perks. Checked when a menu closes.",
};

const cond = <T extends string, S extends z.ZodRawShape>(type: T, title: string, shape: S, description?: string) =>
  z
    .looseObject({
      type: z.literal(type),
      ...shape,
      pluginOverride: pluginFile({ optional: true, hint: "Defaults to the achievement's plugin" }),
      live: bool({ optional: true, default: false, since: "1.4.1" }),
      negate: bool({ optional: true, default: false, since: "1.4.1" }),
      onUnlock: z.array(OnUnlockAction).optional(),
      _editor: ChainEditor.optional(),
    })
    .meta({ title, ...((description ?? DESCRIPTIONS[type]) && { description: description ?? DESCRIPTIONS[type] }) });

const needOneOf = (keys: string[]) => (c: Record<string, unknown>) =>
  keys.some((k) => typeof c[k] === "string" && c[k] !== "");
const oneOfMsg = (keys: string[]) => ({ message: `Set one of: ${keys.join(", ")}`, path: [keys[0]] });

const LOCATION_KEYS = ["formID", "locationID"];
const BOOK_KEYS = ["formID", "bookID"];
const BASE_ACTOR_KEYS = ["formID", "name", "editorID"];

export const conditionSchemas = [
  cond("QuestStageDone", "Quest stage done", {
    formID: formId("base"),
    operation: operation(),
    stage: int(),
  }),
  cond("PlayerLevel", "Player level", { operation: operation({ since: "1.4.1" }), level: int() }),
  cond("SkillLevel", "Skill level", { skill: skill(), operation: operation({ since: "1.4.1" }), level: int() }),
  cond("ItemInInventory", "Item in inventory", { formID: formId("base"), quantity: quantity() }),
  cond(
    "LocationDiscovery",
    "Location discovery",
    {
      formID: formId("reference", { optional: true, hint: "Map marker reference; takes precedence over locationID" }),
      locationID: localized({ optional: true, hint: "Map marker name" }),
      worldspaceID: editorId({ optional: true, hint: "Absent = any worldspace" }),
    },
  ).refine(needOneOf(LOCATION_KEYS), oneOfMsg(LOCATION_KEYS)),
  cond("DragonSoulAbsorbed", "Dragon souls absorbed", { quantity: quantity() }),
  cond("PlayerActivation", "Player activation", {
    formID: formId("reference"),
    quantity: quantity({ optional: true, default: 1, since: "1.4.1" }),
  }),
  cond("SpellCast", "Spell cast", { formID: formId("base"), quantity: quantity({ optional: true, default: 1 }) }),
  cond("MagicEffectApplied", "Magic effect applied", {
    formID: formId("base"),
    quantity: quantity({ optional: true, default: 1 }),
  }),
  cond("FactionRank", "Faction rank", { formID: formId("base"), rank: int({ optional: true, default: 0 }) }),
  cond("ItemEquipped", "Item equipped", { formID: formId("base") }),
  cond("FirstEnterCell", "First enter cell", { cellID: formId("base") }),
  cond("ItemCrafted", "Item crafted", {
    formID: formId("base"),
    quantity: quantity({ optional: true, default: 1, since: "1.4.1" }),
  }),
  cond(
    "BookRead",
    "Book read",
    {
      formID: formId("base", { optional: true, hint: "Takes precedence over bookID" }),
      bookID: localized({ optional: true, hint: "Book name" }),
    },
  ).refine(needOneOf(BOOK_KEYS), oneOfMsg(BOOK_KEYS)),
  cond("ActorDeath", "Actor death", { formID: formId("reference") }),
  cond("GlobalVariableState", "Global variable state", {
    formID: formId("base"),
    operation: operation({ since: "1.4.1" }),
    value: float(),
  }),
  cond("CustomSkillLevel", "Custom skill level", {
    skill: str({ hint: "Custom Skills Framework skill ID" }),
    level: float(),
  }),
  cond("QueryStatValue", "Query stat value", {
    stat: str({ hint: "Tracked stat name, as in the Stats menu" }),
    operation: operation({ since: "1.4.1" }),
    value: float(),
  }),
  cond("PapyrusVariable", "Papyrus variable", {
    formID: formId("reference"),
    script: str(),
    variable: str(),
    value: int(),
  }),
  cond(
    "BaseActorDeath",
    "Base actor death",
    {
      formID: formId("base", { optional: true, hint: "Wins over editorID and name" }),
      editorID: editorId({ optional: true, requires: "po3_Tweaks" }),
      name: localized({ optional: true, hint: "Actor display name" }),
      quantity: quantity({ optional: true, default: 1 }),
    },
  ).refine(needOneOf(BASE_ACTOR_KEYS), oneOfMsg(BASE_ACTOR_KEYS)),
  cond("SpellLearned", "Spell learned", { formID: formId("base") }),
  cond("LocationCleared", "Location cleared", { formID: formId("base") }),
  cond("ShoutLearned", "Shout learned", { formID: formId("base"), words: int() }),
  cond("QuestObjectiveDone", "Quest objective done", { formID: formId("base"), objective: int() }),
  cond("AchievementUnlocked", "Achievement unlocked", {
    achievement: achievementRef(),
    group: str({ optional: true, hint: "Group file name; absent = this group" }),
  }),
  cond("ObjectState", "Object state", { formID: formId("reference"), enabled: bool() }),
  cond("PapyrusBinding", "Papyrus binding", {}, "Met only from Papyrus; carries no fields"),
  cond("PlayerCrime", "Player crime", { factions: formIdList("base"), threshold: int() }),
  cond("WorldspaceDiscovery", "Worldspace discovery", { worldspaceID: editorId(), requiredCount: int() }),
  cond("HasPerk", "Has perk", { formID: formId("base") }),
  cond("HasPerks", "Has perks", { perks: formIdList("base"), threshold: int() }),
] as const;

export const ConditionSchema = z.discriminatedUnion("type", conditionSchemas);
export type Condition = z.infer<typeof ConditionSchema>;

export const COMMON_CONDITION_KEYS: ReadonlySet<string> = new Set(["type", "pluginOverride", "live", "negate", "onUnlock", "_editor"]);

/** Node registry rows (HANDOVER 4.4): one per condition type, fields derived from the schema. */
export const conditionRegistry = Object.fromEntries(
  conditionSchemas.map((s) => [
    s.shape.type.value,
    {
      type: s.shape.type.value as string,
      title: s.meta()?.title ?? s.shape.type.value,
      description: s.meta()?.description,
      fields: describeFields(s, COMMON_CONDITION_KEYS),
    },
  ]),
);
