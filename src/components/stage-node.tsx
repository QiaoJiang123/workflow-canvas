"use client";

import { NodeProps, NodeResizer } from "@xyflow/react";
import { GripHorizontal } from "lucide-react";

interface StageNodeData {
  id: string;
  title: string;
  description?: string;
  color: string;
  collapsed?: boolean;
}

export function StageNodeComponent({ data, selected }: NodeProps) {
  const stage = data as unknown as StageNodeData;
  return (
    <section className={`stage-node ${selected ? "is-selected" : ""}`} style={{ "--stage-color": stage.color } as React.CSSProperties}>
      <NodeResizer isVisible={selected} minWidth={180} minHeight={120} lineClassName="stage-resize-line" handleClassName="stage-resize-handle" />
      <header>
        <GripHorizontal size={15} />
        <strong>{stage.title}</strong>
      </header>
      {!stage.collapsed && <p>{stage.description}</p>}
    </section>
  );
}
