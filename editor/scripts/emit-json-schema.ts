import { writeFileSync } from "node:fs";
import { z } from "zod";
import { GroupSchema } from "../src/schema";

const out = new URL("../schema/achievement-injector.schema.json", import.meta.url);
writeFileSync(out, JSON.stringify(z.toJSONSchema(GroupSchema, { io: "input" }), null, 2) + "\n");
console.log(`wrote ${out.pathname}`);
