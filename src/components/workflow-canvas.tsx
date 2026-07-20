"use client";

import { WorkflowNodeComponent } from "./workflow-node";
import { WorkflowEdgeComponent } from "./workflow-edge";
import { StageNodeComponent } from "./stage-node";
import { DynamicIcon } from "./icon";
import { CATEGORY_COLORS, CATEGORY_LABELS, getNodeDefinition } from "@/domain/node-definitions";
import { getProviderOption } from "@/domain/providers";
import { useWorkflowStore } from "@/store/use-workflow-store";
import type { Workflow } from "@/domain/types";
import type { Edge, Node, NodeChange, OnConnect } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from "@xyflow/react";
import { Bolt, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
  stage: StageNodeComponent
};

const edgeTypes = {
  workflowEdge: WorkflowEdgeComponent
};

const WORKFLOW_NODE_WIDTH = 148;
const WORKFLOW_NODE_HEIGHT = 134;
const WORKFLOW_NODE_CENTER_X = WORKFLOW_NODE_WIDTH / 2;
const WORKFLOW_NODE_CENTER_Y = 66;
const WORKFLOW_NODE_SOURCE_X = WORKFLOW_NODE_WIDTH - 12;
const WORKFLOW_NODE_TARGET_X = 12;

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedItem = useWorkflowStore((state) => state.selectedItem);
  const validationIssues = useWorkflowStore((state) => state.validationIssues);
  const addNode = useWorkflowStore((state) => state.addNode);
  const addEdge = useWorkflowStore((state) => state.addEdge);
  const loadSample = useWorkflowStore((state) => state.loadSample);
  const moveItemLive = useWorkflowStore((state) => state.moveItemLive);
  const resizeGroupLive = useWorkflowStore((state) => state.resizeGroupLive);
  const beginMove = useWorkflowStore((state) => state.beginMove);
  const endMove = useWorkflowStore((state) => state.endMove);
  const select = useWorkflowStore((state) => state.select);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const lastCenteredSelection = useRef("");
  const [viewport, setViewport] = useState({ x: 20, y: 32, zoom: 0.7 });

  const invalidNodeIds = useMemo(
    () => new Set(validationIssues.filter((issue) => issue.targetType === "node" && issue.severity === "error").map((issue) => issue.targetId)),
    [validationIssues]
  );

  const nodes: Node[] = useMemo(
    () => [
      ...workflow.groups.map((group) => ({
        id: group.id,
        type: "stage",
        position: group.position,
        width: group.width,
        height: group.height,
        selected: selectedItem.type === "group" && selectedItem.id === group.id,
        selectable: true,
        draggable: true,
        zIndex: 0,
        data: {
          id: group.id,
          title: group.title,
          description: group.description,
          color: group.color,
          collapsed: group.collapsed
        }
      })),
      ...workflow.nodes.map((node) => ({
        id: node.id,
        type: "workflowNode",
        position: node.position,
        width: WORKFLOW_NODE_WIDTH,
        height: WORKFLOW_NODE_HEIGHT,
        zIndex: 2,
        selected: selectedItem.type === "node" && selectedItem.id === node.id,
        data: {
          id: node.id,
          definitionId: node.definitionId,
          label: node.data.label,
          category: node.data.category,
          description: node.data.description,
          technology: node.data.technology,
          status: node.data.status,
          providerId: String(node.data.configuration.providerId ?? ""),
          invalid: invalidNodeIds.has(node.id)
        }
      }))
    ],
    [invalidNodeIds, selectedItem, workflow.groups, workflow.nodes]
  );

  const edges: Edge[] = useMemo(
    () =>
      workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? "out",
        targetHandle: edge.targetHandle ?? "in",
        label: edge.label,
        animated: edge.animated,
        type: "workflowEdge",
        data: { kind: edge.type },
        selected: selectedItem.type === "edge" && selectedItem.id === edge.id,
        className: `workflow-edge ${edge.type}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        labelBgPadding: [8, 5],
        labelBgBorderRadius: 6,
        labelStyle: { fontSize: 11, fill: "var(--muted)" },
        labelBgStyle: { fill: "var(--panel)", fillOpacity: 0.92 }
      })),
    [selectedItem, workflow.edges]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (isTyping) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        fitView({ padding: 0.16 });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fitView]);

  useEffect(() => {
    const selectionKey = `${selectedItem.type}:${selectedItem.id}`;
    if (selectionKey === lastCenteredSelection.current) return;
    lastCenteredSelection.current = selectionKey;

    if (selectedItem.type === "node") {
      const node = workflow.nodes.find((item) => item.id === selectedItem.id);
      if (node) setCenter(node.position.x + WORKFLOW_NODE_CENTER_X, node.position.y + WORKFLOW_NODE_CENTER_Y, { zoom: 1, duration: 320 });
    }
    if (selectedItem.type === "group") {
      const group = workflow.groups.find((item) => item.id === selectedItem.id);
      if (group) setCenter(group.position.x + group.width / 2, group.position.y + group.height / 2, { zoom: 0.85, duration: 320 });
    }
    if (selectedItem.type === "edge") {
      const edge = workflow.edges.find((item) => item.id === selectedItem.id);
      const source = workflow.nodes.find((item) => item.id === edge?.source);
      const target = workflow.nodes.find((item) => item.id === edge?.target);
      if (source && target) {
        setCenter((source.position.x + target.position.x) / 2 + WORKFLOW_NODE_CENTER_X, (source.position.y + target.position.y) / 2 + WORKFLOW_NODE_CENTER_Y, {
          zoom: 0.95,
          duration: 320
        });
      }
    }
  }, [selectedItem, setCenter, workflow.edges, workflow.groups, workflow.nodes]);

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (connection.source && connection.target) addEdge(connection.source, connection.target, "data");
    },
    [addEdge]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) moveItemLive(change.id, change.position);
        if (change.type === "dimensions" && change.dimensions) resizeGroupLive(change.id, change.dimensions.width, change.dimensions.height);
        if (change.type === "select" && change.selected) {
          const isGroup = workflow.groups.some((group) => group.id === change.id);
          select({ type: isGroup ? "group" : "node", id: change.id });
        }
      }
    },
    [moveItemLive, resizeGroupLive, select, workflow.groups]
  );

  return (
    <section
      className="canvas-shell"
      aria-label="Workflow canvas"
      data-model-node-count={workflow.nodes.length}
      data-model-edge-count={workflow.edges.length}
      data-flow-node-count={nodes.length}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const definitionId = event.dataTransfer.getData("application/workflow-node");
        if (!definitionId) return;
        addNode(definitionId, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }}
    >
      {!workflow.nodes.length && (
        <div className="canvas-empty-state">
          <strong>Start designing your AI workflow</strong>
          <span>Drag a node from the library or open the sample workflow.</span>
          <div>
            <button type="button" onClick={() => addNode("database", { x: 160, y: 180 })}>
              Add Database
            </button>
            <button type="button" onClick={loadSample}>
              Open Sample
            </button>
          </div>
        </div>
      )}
      <ModelStageLayer workflow={workflow} selectedItem={selectedItem} viewport={viewport} onSelect={select} />
      <ModelEdgeLayer workflow={workflow} viewport={viewport} />
      <ModelNodeLayer workflow={workflow} invalidNodeIds={invalidNodeIds} selectedItem={selectedItem} viewport={viewport} onSelect={select} />
      <ReactFlow
        key={`${workflow.id}:${workflow.nodes.length}:${WORKFLOW_NODE_WIDTH}x${WORKFLOW_NODE_HEIGHT}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={beginMove}
        onNodeDragStop={endMove}
        onConnect={onConnect}
        onNodeClick={(_, node) => select({ type: workflow.groups.some((group) => group.id === node.id) ? "group" : "node", id: node.id })}
        onEdgeClick={(_, edge) => select({ type: "edge", id: edge.id })}
        onMove={(_, nextViewport) => setViewport(nextViewport)}
        onPaneClick={() => select({ type: "workflow", id: workflow.id })}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[16, 16]}
        defaultViewport={{ x: 20, y: 32, zoom: 0.7 }}
        minZoom={0.4}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={40} size={0.7} color="var(--canvas-dot)" />
        <Controls showInteractive={false} onFitView={() => fitView({ padding: 0.16 })} />
        <MiniMap pannable zoomable nodeStrokeWidth={2} className="workflow-minimap" />
      </ReactFlow>
    </section>
  );
}

function ModelEdgeLayer({
  workflow,
  viewport
}: {
  workflow: Workflow;
  viewport: { x: number; y: number; zoom: number };
}) {
  const nodesById = useMemo(() => new Map(workflow.nodes.map((node) => [node.id, node])), [workflow.nodes]);
  const edges = workflow.edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return null;
      const sourceX = (source.position.x + WORKFLOW_NODE_SOURCE_X) * viewport.zoom + viewport.x;
      const sourceY = (source.position.y + WORKFLOW_NODE_CENTER_Y) * viewport.zoom + viewport.y;
      const targetX = (target.position.x + WORKFLOW_NODE_TARGET_X) * viewport.zoom + viewport.x;
      const targetY = (target.position.y + WORKFLOW_NODE_CENTER_Y) * viewport.zoom + viewport.y;
      const midX = sourceX + Math.max(60, (targetX - sourceX) / 2);
      return {
        id: edge.id,
        type: edge.type,
        path: `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));

  if (!edges.length) return null;

  return (
    <svg className="workflow-model-edges" aria-hidden="true">
      <defs>
        <marker id="workflow-model-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <g key={edge.id} className={`model-edge ${edge.type}`}>
          <path d={edge.path} markerEnd="url(#workflow-model-arrow)" />
        </g>
      ))}
    </svg>
  );
}

function ModelStageLayer({
  workflow,
  selectedItem,
  viewport,
  onSelect
}: {
  workflow: Workflow;
  selectedItem: ReturnType<typeof useWorkflowStore.getState>["selectedItem"];
  viewport: { x: number; y: number; zoom: number };
  onSelect: ReturnType<typeof useWorkflowStore.getState>["select"];
}) {
  if (!workflow.groups.length) return null;

  return (
    <div className="workflow-model-stages" aria-hidden="true">
      {workflow.groups.map((group) => (
        <section
          key={group.id}
          className={`stage-node model-stage ${selectedItem.type === "group" && selectedItem.id === group.id ? "is-selected" : ""}`}
          style={
            {
              "--stage-color": group.color,
              left: group.position.x * viewport.zoom + viewport.x,
              top: group.position.y * viewport.zoom + viewport.y,
              width: group.width,
              height: group.height,
              transform: `scale(${viewport.zoom})`
            } as React.CSSProperties
          }
          onClick={() => onSelect({ type: "group", id: group.id })}
        >
          <header>
            <strong>{group.title}</strong>
          </header>
          {group.description && <p>{group.description}</p>}
        </section>
      ))}
    </div>
  );
}

function ModelNodeLayer({
  workflow,
  invalidNodeIds,
  selectedItem,
  viewport,
  onSelect
}: {
  workflow: Workflow;
  invalidNodeIds: Set<string | undefined>;
  selectedItem: ReturnType<typeof useWorkflowStore.getState>["selectedItem"];
  viewport: { x: number; y: number; zoom: number };
  onSelect: ReturnType<typeof useWorkflowStore.getState>["select"];
}) {
  if (!workflow.nodes.length) return null;

  return (
    <div className="workflow-model-nodes">
      {workflow.nodes.map((node) => {
        const definition = getNodeDefinition(node.definitionId);
        const color = CATEGORY_COLORS[node.data.category];
        const isTrigger = !definition?.inputs.length;
        const isSelected = selectedItem.type === "node" && selectedItem.id === node.id;
        const isInvalid = invalidNodeIds.has(node.id);
        const technology = node.data.technology || CATEGORY_LABELS[node.data.category];
        const provider = getProviderOption(node.data.configuration.providerId);

        return (
          <article
            key={node.id}
            className={`workflow-node model-node ${isSelected ? "is-selected" : ""} ${isInvalid ? "is-invalid" : ""}`}
            style={
              {
                "--node-accent": color,
                left: node.position.x * viewport.zoom + viewport.x,
                top: node.position.y * viewport.zoom + viewport.y,
                transform: `scale(${viewport.zoom})`
              } as React.CSSProperties
            }
            onClick={() => onSelect({ type: "node", id: node.id })}
            onDoubleClick={() => onSelect({ type: "node", id: node.id })}
          >
            {definition?.inputs.length ? <span className="node-handle model-handle model-target" /> : null}
            {isTrigger && (
              <span className="node-trigger" aria-label="Trigger node" title="Trigger node">
                <Bolt size={13} />
              </span>
            )}
            <div className="node-tile">
              <span className="node-operation" title={technology}>
                {formatOperation(technology)}
              </span>
              <button className="node-menu" type="button" aria-label="Node actions" title="Node actions">
                <MoreHorizontal size={15} />
              </button>
              <span className="node-icon" aria-hidden="true">
                {provider ? <Image src={provider.icon} alt="" width={28} height={28} /> : <DynamicIcon name={definition?.icon ?? "Circle"} />}
              </span>
              {provider && <span className="node-provider-badge">{provider.name}</span>}
            </div>
            <div className="node-caption">
              <strong title={node.data.label}>{node.data.label}</strong>
              <span className={`node-status ${node.data.status ?? "not_started"}`} title={`Status: ${formatStatus(node.data.status)}`} />
            </div>
            {definition?.outputs.length ? <span className="node-handle model-handle model-source" /> : null}
          </article>
        );
      })}
    </div>
  );
}

function formatOperation(value: string) {
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatStatus(status?: string) {
  return (status || "not_started").replaceAll("_", " ");
}
