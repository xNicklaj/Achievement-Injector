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
  /** At most one per flow chain. */
  unique: boolean;
  fields: FieldInfo[];
  /** Exists only to carry data (an unknown condition type): never offered for creation. */
  hidden?: boolean;
};

const field = (f: Pick<FieldInfo, "name" | "widget"> & Partial<FieldInfo>): FieldInfo => ({ optional: false, ...f });

const base = { description: undefined, keywords: [], flowIn: false, flowOut: false, condOut: false, condIn: false, locOut: false, achOut: false, iconOut: false, unique: false };

// Fields come straight from the Zod schema so the widgets cannot drift from validation.
const achievementFields = describeFields(
  AchievementSchema,
  new Set(["conditions", "onUnlock", "joinType", "_editor"]),
);

const flowNodes: NodeDef[] = [
  { ...base, kind: "CreateAchievement", category: "entry", title: "Create Achievement", flowOut: true, achOut: true, keywords: ["achievement", "start", "entry"], fields: achievementFields },
  { ...base, kind: "AddConditions", category: "flow", title: "Add Conditions", flowIn: true, flowOut: true, condIn: true, unique: true, keywords: ["conditions", "collect"], fields: [] },
  {
    ...base,
    kind: "JoinType",
    category: "flow",
    title: "Join Type",
    flowIn: true,
    flowOut: true,
    unique: true,
    keywords: ["and", "or", "join"],
    // The node exists to set this value, so it is required here even though the key is optional in the JSON.
    fields: describeFields(AchievementSchema, new Set(Object.keys(AchievementSchema.shape).filter((k) => k !== "joinType"))).map((f) => ({ ...f, optional: false })),
  },
  { ...base, kind: "RunCommand", category: "flow", title: "Run Command", flowIn: true, flowOut: true, keywords: ["console", "onUnlock", "action"], fields: [field({ name: "command", widget: "string" })] },
  { ...base, kind: "CallPapyrus", category: "flow", title: "Call Papyrus", flowIn: true, flowOut: true, keywords: ["script", "function", "onUnlock", "action"], fields: [field({ name: "script", widget: "string" }), field({ name: "function", widget: "string", description: "Must be a Global function" })] },
  { ...base, kind: "Icon", category: "asset", title: "Icon", iconOut: true, keywords: ["image", "dds", "texture", "picture"], fields: [field({ name: "file", widget: "iconPath", description: "File name in Icons/<Group>/" })] },
  { ...base, kind: "LocalizedText", category: "localization", title: "Localized Text", locOut: true, keywords: ["translation", "key", "language"], fields: [field({ name: "key", widget: "string", description: "Written as $key" })] },
];

const conditionNodes: NodeDef[] = Object.values(conditionRegistry).map((c) => ({
  ...base,
  kind: c.type,
  category: "condition" as const,
  title: c.title.replace(/(^| )[a-z]/g, (m) => m.toUpperCase()), // node names are Title Case
  description: c.description,
  keywords: [c.type],
  condOut: true,
  // A condition's `onUnlock` actions hang off its flow pin.
  flowOut: true,
  fields: [...c.fields, field({ name: "pluginOverride", widget: "plugin", optional: true, description: "Defaults to the group's base plugin" })],
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
 * Create Achievement node (`ach`), an icon file by an Icon node (`icon`). The wire runs from `<kind>-out` to `<kind>:<field>`.
 */
export type LinkKind = "loc" | "ach" | "icon";
export const LINK_KINDS: readonly LinkKind[] = ["loc", "ach", "icon"];
const LINK_WIDGET = { localizedString: "loc", achievementRef: "ach", iconPath: "icon" } as const;
/** The link kind a field accepts, or null. An Icon node's own file is typed, never wired. */
export const linkKind = (def: NodeDef, f: FieldInfo): LinkKind | null => (def.kind === "Icon" ? null : LINK_WIDGET[f.widget as keyof typeof LINK_WIDGET] ?? null);
export const linkOut = (def: NodeDef): LinkKind | null => (def.locOut ? "loc" : def.achOut ? "ach" : def.iconOut ? "icon" : null);

/** `wired`: fields fed by a LocalizedText node, which count as filled. */
export const missingRequired = (def: NodeDef, values: Record<string, unknown>, wired: ReadonlySet<string> = new Set()) =>
  def.fields.some((f) => !f.optional && !wired.has(f.name) && (values[f.name] === undefined || values[f.name] === ""));

/** Names of `node`'s fields that have a LocalizedText wire into them. */
export const wiredFields = (edges: { target: string; targetHandle?: string | null }[], id: string) =>
  new Set(edges.filter((e) => e.target === id && e.targetHandle && LINK_KINDS.some((k) => e.targetHandle!.startsWith(`${k}:`))).map((e) => e.targetHandle!.slice(e.targetHandle!.indexOf(":") + 1)));
