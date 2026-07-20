"use client";

import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from "@xyflow/react";

export function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  selected,
  data
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18
  });
  const kind = typeof data?.kind === "string" ? data.kind : "data";

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} className={`workflow-edge-path ${kind} ${selected ? "selected" : ""}`} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="workflow-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
