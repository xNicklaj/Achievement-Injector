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
export const ChainEditor = EditorNode.extend({ chain: z.array(XY).optional() });

/** `onUnlock` entries (Runnable.cpp). Papyrus targets a Global function: DispatchStaticCall, no form to bind. */
export const OnUnlockAction = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("command"), command: z.string().min(1) }),
  z.looseObject({ type: z.literal("papyrus"), script: z.string().min(1), function: z.string().min(1) }),
]);

// `>=`/`GT` and `==`/`EQ` are the only operators CompareValues knows; anything else never matches.
const operation = (o: { since?: string } = {}) => enumOf([">=", "GT", "==", "EQ"], { optional: true, default: ">=", ...o });
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

const cond = <T extends string, S extends z.ZodRawShape>(type: T, title: string, shape: S, description?: string) =>
  z
    .looseObject({
      type: z.literal(type),
      ...shape,
      pluginOverride: pluginFile({ optional: true, hint: "Defaults to the group's base plugin" }),
      onUnlock: z.array(OnUnlockAction).optional(),
      _editor: ChainEditor.optional(),
    })
    .meta({ title, ...(description && { description }) });

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
  cond("PlayerLevel", "Player level", { level: int() }),
  cond("SkillLevel", "Skill level", { skill: skill(), level: int() }),
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

export const COMMON_CONDITION_KEYS: ReadonlySet<string> = new Set(["type", "pluginOverride", "onUnlock", "_editor"]);

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
