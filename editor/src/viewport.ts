import type { Viewport } from "@xyflow/react";

/** Where the canvas was looking, kept while another view is open (the canvas unmounts). Cleared when a document is opened, so it fits to the new graph. */
export const remembered: { viewport: Viewport | null; /** The achievement list is open: kept like the viewport, since the canvas unmounts. */ listOpen: boolean } = { viewport: null, listOpen: true };
