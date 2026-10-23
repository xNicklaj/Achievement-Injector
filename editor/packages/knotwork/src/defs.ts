export type PinDef = { id: string; side: "in" | "out"; label?: string };
export type NodeDef = { kind: string; category: string; title: string; keywords: string[]; hidden?: boolean; pins: PinDef[] };
