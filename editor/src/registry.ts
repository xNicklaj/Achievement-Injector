import type { Edge } from "@xyflow/react";
import { incoming } from "@xnicklaj/knotwork";
import {
  AchievementSchema,
  type FieldInfo,
  conditionRegistry,
  describeFields,
} from "./schema";

export type Category = "entry" | "flow" | "condition" | "localization" | "asset";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "entry", label: "Entry" },
  { id: "flow", label: "Flow" },
  { id: "condition", label: "Conditions" },
  { id: "localization", label: "Localization" },
  { id: "asset", label: "Assets" },
];

export type NodeDef = {
  kind: string;
  category: Category;
  title: string;
  description?: string;
  keywords: string[];
  flowIn: boolean;
  flowOut: boolean;
  /** Data output: the node is a Condition value. */
  condOut: boolean;
  /** Multi data input collecting Condition values. */
  condIn: boolean;
  /** Text output feeding localizable fields. */
  locOut: boolean;
  /** Output naming this achievement, for `AchievementUnlocked` fields. */
  achOut: boolean;
  /** Output naming an icon file, for achievement `icon` fields. */
  iconOut: boolean;
  /** Output naming a plugin file, for `pluginOverride` fields. */
  pluginOut: boolean;
  /** At most one per flow chain. */
  unique: boolean;
  fields: FieldInfo[];
  /** Sits between a condition and Add Conditions, passing the condition through with a flag set (Live, Negate). */
  modifier?: boolean;
  /** First DLL version that reads this node. Absent = BASELINE_VERSION. */
  since?: string;
  /** Exists only to carry data (an unknown condition type): never offered for creation. */
  hidden?: boolean;
};

const field = (f: Pick<FieldInfo, "name" | "widget"> & Partial<FieldInfo>): FieldInfo => ({ optional: false, ...f });

const base = { description: undefined, keywords: [], flowIn: false, flowOut: false, condOut: false, condIn: false, locOut: false, achOut: false, iconOut: false, pluginOut: false, unique: false };

// Fields come straight from the Zod schema so the widgets cannot drift from validation.
const achievementFields = describeFields(
  AchievementSchema,
  new Set(["conditions", "onUnlock", "joinType", "_editor"]),
);

const flowNodes: NodeDef[] = [
  { ...base, kind: "CreateAchievement", description: "The achievement itself. Its Unlock pin feeds an Achievement Unlocked condition; the flow pin continues to Add Conditions, Join Type and On Unlock actions.", category: "entry", title: "Create Achievement", flowOut: true, achOut: true, keywords: ["achievement", "start", "entry"], fields: achievementFields },
  { ...base, kind: "AddConditions", description: "Collects the conditions that must be met. Wire each condition (directly or through Live / Negate) into its input. Only one per achievement.", category: "flow", title: "Add Conditions", flowIn: true, flowOut: true, condIn: true, unique: true, keywords: ["conditions", "collect"], fields: [] },
  {
    ...base,
    kind: "JoinType",
    description: "How the conditions combine. Without this node the default is OR. Only one per achievement.", category: "flow",
    title: "Join Type",
    flowIn: true,
    flowOut: true,
    unique: true,
    keywords: ["and", "or", "join"],
    // The node exists to set this value, so it is required here even though the key is optional in the JSON.
    fields: describeFields(AchievementSchema, new Set(Object.keys(AchievementSchema.shape).filter((k) => k !== "joinType"))).map((f) => ({ ...f, optional: false })),
  },
  { ...base, kind: "Live", category: "flow", title: "Live", description: "Re-checked whenever another condition fires instead of latching once met. Place between a condition and Add Conditions.", modifier: true, condOut: true, since: "1.4.1", keywords: ["live", "realtime", "state"], fields: [] },
  { ...base, kind: "Negate", category: "flow", title: "Negate", description: "Met while the condition is false. Needs a Live node between the condition and this node.", modifier: true, condOut: true, since: "1.4.1", keywords: ["negate", "not", "invert", "live"], fields: [] },
  { ...base, kind: "RunCommand", description: "Runs a console command when this achievement or condition unlocks.", category: "flow", title: "Run Command", flowIn: true, flowOut: true, keywords: ["console", "onUnlock", "action"], fields: [field({ name: "command", widget: "string" })] },
  { ...base, kind: "CallPapyrus", description: "Calls a Global Papyrus function when this achievement or condition unlocks.", category: "flow", title: "Call Papyrus", flowIn: true, flowOut: true, keywords: ["script", "function", "onUnlock", "action"], fields: [field({ name: "script", widget: "string" }), field({ name: "function", widget: "string", description: "Must be a Global function" })] },
  { ...base, kind: "Icon", description: "An .dds image from Icons/<Group>/ to use as an achievement icon. Wire it into an achievement's Icon field.", category: "asset", title: "Icon", iconOut: true, keywords: ["image", "dds", "texture", "picture"], fields: [field({ name: "file", widget: "iconPath", description: "File name in Icons/<Group>/" })] },
  { ...base, kind: "PluginOverride", description: "Sets the plugin that form IDs are looked up in. Wire it into an achievement, which passes it on to its conditions, or into a single condition, which then uses it instead.", category: "asset", title: "Plugin Override", pluginOut: true, keywords: ["plugin", "esp", "esm", "mod", "inherit"], fields: [field({ name: "plugin", widget: "plugin", description: "An .esp, .esm or .esl file name" })] },
  { ...base, kind: "LocalizedText", description: "A translation key written as $key. Wire it into any text field, and fill in each language on this node.", category: "localization", title: "Localized Text", locOut: true, keywords: ["translation", "key", "language"], fields: [field({ name: "key", widget: "string", description: "Written as $key" })] },
];

const conditionNodes: NodeDef[] = Object.values(conditionRegistry).map((c) => ({
  ...base,
  kind: c.type,
  category: "condition" as const,
  title: c.title.replace(/(^| )[a-z]/g, (m) => m.toUpperCase()), // node names are Title Case
  description: c.description,
  keywords: [c.type],
  condOut: true,
  // Conditions Met collects its own conditions, like Add Conditions does for the achievement.
  condIn: c.type === "ConditionsMet",
  ...(c.since && { since: c.since }),
  // A condition's `onUnlock` actions hang off its flow pin.
  flowOut: true,
  // Conditions Met passes nothing down: its sub-conditions inherit the achievement's plugin, not the override of the node that holds them.
  fields: c.type === "ConditionsMet" ? c.fields : [...c.fields, field({ name: "pluginOverride", widget: "plugin", optional: true, description: "Inherited from the achievement, then the group" })],
}));

/** A condition type this editor does not know: kept as it is (the real type is in `extra.type`) and flagged, so nothing is lost. */
export const UNKNOWN_CONDITION = "UnknownCondition";
const unknownCondition: NodeDef = { ...base, kind: UNKNOWN_CONDITION, category: "condition", title: "Unknown Condition", condOut: true, flowOut: true, hidden: true, fields: [] };

export const registry: Record<string, NodeDef> = Object.fromEntries([...flowNodes, ...conditionNodes, unknownCondition].map((d) => [d.kind, d]));
export const nodeDefs = Object.values(registry).filter((d) => !d.hidden);

export const isCondition = (kind: string) => registry[kind]?.category === "condition";
export const isAction = (kind: string) => kind === "RunCommand" || kind === "CallPapyrus";

export const isLocalizable = (f: FieldInfo) => f.widget === "localizedString";

/**
 * Fields that can be fed by another node instead of typed: text by a Localized Text node (`loc`), an achievement name by a
 * Create Achievement node (`ach`), an icon file by an Icon node (`icon`), a plugin by a Plugin Override node (`plugin`). The wire runs from `<kind>-out` to `<kind>:<field>`.
 */
export type LinkKind = "loc" | "ach" | "icon" | "plugin";
export const LINK_KINDS: readonly LinkKind[] = ["loc", "ach", "icon", "plugin"];
const LINK_WIDGET = { localizedString: "loc", achievementRef: "ach", iconPath: "icon", plugin: "plugin" } as const;
/** The link kind a field accepts, or null. An Icon or Plugin Override node's own value is typed, never wired. */
export const linkKind = (def: NodeDef, f: FieldInfo): LinkKind | null => (def.kind === "Icon" || def.kind === "PluginOverride" ? null : LINK_WIDGET[f.widget as keyof typeof LINK_WIDGET] ?? null);
export const linkOut = (def: NodeDef): LinkKind | null => (def.locOut ? "loc" : def.achOut ? "ach" : def.iconOut ? "icon" : def.pluginOut ? "plugin" : null);

/** `wired`: fields fed by a LocalizedText node, which count as filled. */
export const missingRequired = (def: NodeDef, values: Record<string, unknown>, wired: ReadonlySet<string> = new Set()) =>
  def.fields.some((f) => !f.optional && !wired.has(f.name) && (values[f.name] === undefined || values[f.name] === ""));

/** Names of `node`'s fields that have a LocalizedText wire into them. */
export const wiredFields = (edges: Edge[], id: string) =>
  new Set(incoming(edges, id).filter((e) => e.targetHandle && LINK_KINDS.some((k) => e.targetHandle!.startsWith(`${k}:`))).map((e) => e.targetHandle!.slice(e.targetHandle!.indexOf(":") + 1)));
