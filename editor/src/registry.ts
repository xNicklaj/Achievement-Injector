import {
  AchievementSchema,
  type FieldInfo,
  conditionRegistry,
  describeFields,
} from "./schema";

export type Category = "entry" | "flow" | "condition" | "localization";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "entry", label: "Entry" },
  { id: "flow", label: "Flow" },
  { id: "condition", label: "Conditions" },
  { id: "localization", label: "Localization" },
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
  /** At most one per flow chain. */
  unique: boolean;
  fields: FieldInfo[];
};

const field = (f: Pick<FieldInfo, "name" | "widget"> & Partial<FieldInfo>): FieldInfo => ({ optional: false, ...f });

const base = { description: undefined, keywords: [], flowIn: false, flowOut: false, condOut: false, condIn: false, locOut: false, unique: false };

// Fields come straight from the Zod schema so the widgets cannot drift from validation.
const achievementFields = describeFields(
  AchievementSchema,
  new Set(["conditions", "onUnlock", "joinType", "_editor"]),
);

const flowNodes: NodeDef[] = [
  { ...base, kind: "CreateAchievement", category: "entry", title: "Create Achievement", flowOut: true, keywords: ["achievement", "start", "entry"], fields: achievementFields },
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
  { ...base, kind: "LocalizedText", category: "localization", title: "Localized Text", locOut: true, keywords: ["translation", "key", "language"], fields: [field({ name: "key", widget: "string", description: "Written as $key" })] },
];

const conditionNodes: NodeDef[] = Object.values(conditionRegistry).map((c) => ({
  ...base,
  kind: c.type,
  category: "condition" as const,
  title: c.title,
  description: c.description,
  keywords: [c.type],
  condOut: true,
  fields: [...c.fields, field({ name: "pluginOverride", widget: "plugin", optional: true, description: "Defaults to the group's base plugin" })],
}));

export const registry: Record<string, NodeDef> = Object.fromEntries([...flowNodes, ...conditionNodes].map((d) => [d.kind, d]));
export const nodeDefs = Object.values(registry);

export const isLocalizable = (f: FieldInfo) => f.widget === "localizedString";

/** `wired`: fields fed by a LocalizedText node, which count as filled. */
export const missingRequired = (def: NodeDef, values: Record<string, unknown>, wired: ReadonlySet<string> = new Set()) =>
  def.fields.some((f) => !f.optional && !wired.has(f.name) && (values[f.name] === undefined || values[f.name] === ""));

/** Names of `node`'s fields that have a LocalizedText wire into them. */
export const wiredFields = (edges: { target: string; targetHandle?: string | null }[], id: string) =>
  new Set(edges.filter((e) => e.target === id && e.targetHandle?.startsWith("loc:")).map((e) => e.targetHandle!.slice(4)));
