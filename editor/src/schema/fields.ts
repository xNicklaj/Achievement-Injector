import { z } from "zod";

/** DLL version the schema targets (HANDOVER 3.7). Fields newer than BASELINE carry an explicit `since`. */
export const TARGET_VERSION = "1.4.1";
export const BASELINE_VERSION = "1.4.0";

export type Widget =
  | "bool"
  | "integer"
  | "float"
  | "string"
  | "localizedString"
  | "editorId"
  | "formId"
  | "enum"
  | "list"
  | "plugin"
  | "achievementRef"
  | "iconPath";

/** Per-field UI metadata. Read back through `describeFields`; also lands in the generated JSON Schema. */
declare module "zod" {
  interface GlobalMeta {
    widget?: Widget;
    /** First DLL version that reads this field. Absent = BASELINE_VERSION. */
    since?: string;
    /** Value the DLL assumes when the key is absent. Never applied by parsing, so explicit defaults survive a round-trip. */
    default?: unknown;
    /** `base` = form record, `reference` = placed reference (HANDOVER 3.6). */
    formKind?: "base" | "reference";
    options?: readonly string[];
    item?: Widget;
    /** Other mod/plugin that must be loaded for the field to work. */
    requires?: string;
  }
}

type Opts = {
  optional?: boolean;
  since?: string;
  default?: unknown;
  hint?: string;
};
type Finished<S extends z.ZodType, O extends Opts> = O extends { optional: true } ? z.ZodOptional<S> : S;

function finish<S extends z.ZodType, O extends Opts>(
  s: S,
  widget: Widget,
  o: O,
  extra: Partial<z.GlobalMeta> = {},
): Finished<S, O> {
  const out = o.optional ? s.optional() : s;
  return out.meta({
    widget,
    since: o.since ?? BASELINE_VERSION,
    ...(o.default !== undefined && { default: o.default }),
    ...(o.hint && { description: o.hint }),
    ...extra,
  }) as unknown as Finished<S, O>;
}

// Local form IDs: parsed with `std::hex`; `isHex()` (BookRead, BaseActorDeath) also rejects a `0x` prefix.
const FORM_ID = /^[0-9a-fA-F]{1,8}$/;
const formIdString = z.string().regex(FORM_ID, "Expected 1-8 hex digits, no 0x prefix");

export const isLocalizedKey = (s: string) => s.startsWith("$");

export const bool = <O extends Opts = {}>(o: O = {} as O) => finish(z.boolean(), "bool", o);
export const int = <O extends Opts = {}>(o: O = {} as O) => finish(z.number().int(), "integer", o);
export const float = <O extends Opts = {}>(o: O = {} as O) => finish(z.number(), "float", o);
export const str = <O extends Opts = {}>(o: O = {} as O) => finish(z.string(), "string", o);
export const editorId = <O extends Opts = {}>(o: O = {} as O) => finish(z.string().min(1), "editorId", o);
export const iconPath = <O extends Opts = {}>(o: O = {} as O) =>
  finish(z.string().min(1), "iconPath", o);
export const pluginFile = <O extends Opts = {}>(o: O = {} as O) =>
  finish(z.string().regex(/\.(esp|esm|esl)$/i, "Expected a .esp/.esm/.esl file name"), "plugin", o);
export const achievementRef = <O extends Opts = {}>(o: O = {} as O) =>
  finish(z.string().min(1), "achievementRef", o);

/** Inline text that may also be a `$key` into Localizations/<Group>_<LANG>.txt (HANDOVER 3.13). */
export const localized = <O extends Opts = {}>(o: O = {} as O) => finish(z.string().min(1), "localizedString", o);

export const formId = <O extends Opts = {}>(kind: "base" | "reference", o: O = {} as O) =>
  finish(formIdString, "formId", o, { formKind: kind });

export const enumOf = <const V extends readonly [string, ...string[]], O extends Opts = {}>(
  values: V,
  o: O = {} as O,
) => finish(z.enum(values), "enum", o, { options: values });

export const formIdList = <O extends Opts = {}>(kind: "base" | "reference", o: O = {} as O) =>
  finish(z.array(formIdString).min(1), "list", o, { item: "formId", formKind: kind });

export type FieldInfo = z.GlobalMeta & { name: string; optional: boolean };

/** Flatten an object schema into the rows the node registry and inline widgets are built from. */
export function describeFields(obj: z.ZodObject, skip: ReadonlySet<string> = new Set()): FieldInfo[] {
  return Object.entries(obj.shape)
    .filter(([name]) => !skip.has(name))
    .map(([name, s]) => ({ ...(s as z.ZodType).meta(), name, optional: (s as z.ZodType).isOptional() }));
}
