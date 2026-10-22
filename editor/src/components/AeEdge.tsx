import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/** The selection colour of a node (--select-soft is its glow), wide enough to read around the 2px line. */
const HALO = { stroke: "var(--select-soft)", strokeWidth: 10 };

/** The default curve, with a halo under it while selected. The line keeps its own colour and width. */
export function AeEdge({ id, selected, style, markerEnd, markerStart, interactionWidth, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      {selected && <path d={path} fill="none" strokeLinecap="round" pointerEvents="none" style={HALO} />}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} markerStart={markerStart} interactionWidth={interactionWidth} />
    </>
  );
}
