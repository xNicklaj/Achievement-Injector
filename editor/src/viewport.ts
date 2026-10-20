import type { Viewport } from "@xyflow/react";

/** Where the canvas was looking, kept while another view is open (the canvas unmounts). Cleared when a document is opened, so it fits to the new graph. */
export const remembered: { viewport: Viewport | null } = { viewport: null };
