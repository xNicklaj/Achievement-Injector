import { z } from "zod";
import { ChainEditor, ConditionSchema, OnUnlockAction } from "./conditions";
import { bool, enumOf, iconPath, localized, pluginFile, str } from "./fields";

// Root fields: src/plugin.cpp (ReadAchievementDirectory). Achievement fields: Achievement.cpp constructor.

export const SCHEMA_VERSION = 1;

const XY = z.object({ x: z.number(), y: z.number() });

export const AchievementSchema = z.looseObject({
  achievementName: localized({ hint: "Unique within the group; progress and the API key off it" }),
  description: localized(),
  hideDescription: bool({ optional: true, default: false }),
  showInMenu: bool({ optional: true, default: true }),
  showPopup: bool({ optional: true, default: true }),
  icon: iconPath({ optional: true, hint: "File name in Icons/<Group>/ (512x512 DDS, BC3 max)" }),
  notificationSound: str({ optional: true, hint: "Ignored when the MCM sound override is on" }),
  // The DLL treats any value other than "OR" as AND; absent means OR.
  joinType: enumOf(["AND", "OR"], { optional: true, default: "OR" }),
  // Absent is read as empty (never unlocks); the editor reports it as "No conditions".
  conditions: z.array(ConditionSchema).optional(),
  onUnlock: z.array(OnUnlockAction).optional(),
  _editor: ChainEditor.optional(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const GroupSchema = z
  .looseObject({
    groupName: localized(),
    plugin: pluginFile({ hint: "Base plugin for every condition without pluginOverride" }),
    showInMenu: bool({ optional: true, default: true }),
    achievements: z.array(AchievementSchema),
    // `keys` holds the canvas position of each LocalizedText node, which has no JSON object of its own.
    // `modVersion` is the oldest mod version that reads everything in the file; an editor that targets an older one refuses to open it.
    _editor: z.object({ schemaVersion: z.number().int(), modVersion: z.string().optional(), keys: z.record(z.string(), XY).optional() }).optional(),
  })
  .superRefine((g, ctx) => {
    const seen = new Set<string>();
    g.achievements.forEach((a, i) => {
      if (seen.has(a.achievementName))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate achievementName "${a.achievementName}"`,
          path: ["achievements", i, "achievementName"],
        });
      seen.add(a.achievementName);
    });
  });
export type Group = z.infer<typeof GroupSchema>;
