"use client";

import { WorkflowNodeComponent } from "./workflow-node";
import { StageNodeComponent } from "./stage-node";
import { useWorkflowStore } from "@/store/use-workflow-store";
import type { Workflow } from "@/domain/types";
import type { Edge, FinalConnectionState, Node, NodeChange, OnConnect, OnConnectEnd, OnConnectStart } from "@xyflow/react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
  stage: StageNodeComponent
};

const WORKFLOW_NODE_WIDTH = 148;
const WORKFLOW_NODE_HEIGHT = 134;
const WORKFLOW_NODE_CENTER_X = WORKFLOW_NODE_WIDTH / 2;
const WORKFLOW_NODE_CENTER_Y = 66;
const NODE_TILE_LEFT_X = 30;
const NODE_TILE_RIGHT_X = 118;
const NODE_TILE_TOP_Y = 18;
const NODE_TILE_BOTTOM_Y = 94;
const NODE_TILE_CENTER_Y = 56;

type ConnectionSide = "left" | "right" | "top" | "bottom";

type DragConnectionStart = {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target" | null;
};

type DraftConnection = {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target";
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
};

type ConnectionTarget = {
  id: string;
  side: ConnectionSide;
};

type EdgeEndpointDrag = {
  edgeId: string;
  endpoint: "source" | "target";
  fixedPoint: { x: number; y: number };
  fixedSide: ConnectionSide;
  currentPoint: { x: number; y: number };
};

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
  const updateEdge = useWorkflowStore((state) => state.updateEdge);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const select = useWorkflowStore((state) => state.select);
  const { screenToFlowPosition, fitView, setEdges: setFlowEdges } = useReactFlow();
  const [viewport, setViewport] = useState({ x: 20, y: 32, zoom: 0.7 });
  const [draftConnection, setDraftConnection] = useState<DraftConnection | null>(null);
  const [edgeEndpointDrag, setEdgeEndpointDrag] = useState<EdgeEndpointDrag | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<ConnectionTarget | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState("");
  const [hoveredEndpointEdgeId, setHoveredEndpointEdgeId] = useState("");
  const dragConnectionStartRef = useRef<DragConnectionStart | null>(null);
  const draftConnectionRef = useRef<DraftConnection | null>(null);
  const edgeEndpointDragRef = useRef<EdgeEndpointDrag | null>(null);
  const focusedNodeId = selectedItem.type === "node" ? selectedItem.id : hoveredNodeId;
  const focusedEdgeId = edgeEndpointDrag?.edgeId || hoveredEndpointEdgeId || (selectedItem.type === "edge" ? selectedItem.id : "");

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
          invalid: invalidNodeIds.has(node.id),
          connectionTargetSide: connectionTarget?.id === node.id ? connectionTarget.side : undefined,
          isConnectionSource: draftConnection?.nodeId === node.id
        }
      }))
    ],
    [connectionTarget, draftConnection, invalidNodeIds, selectedItem, workflow.groups, workflow.nodes]
  );

  const edges: Edge[] = useMemo(
    () =>
      workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle && edge.sourceHandle !== "out" ? edge.sourceHandle : undefined,
        targetHandle: edge.targetHandle && edge.targetHandle !== "in" ? edge.targetHandle : undefined,
        label: edge.label,
        animated: edge.animated,
        type: "smoothstep",
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
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

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

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (connection.source && connection.target) {
        dragConnectionStartRef.current = null;
        addEdge(connection.source, connection.target, "data", {
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle
        });
      }
    },
    [addEdge]
  );

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    dragConnectionStartRef.current = params.nodeId
      ? {
          nodeId: params.nodeId,
          handleId: params.handleId,
          handleType: params.handleType
        }
      : null;
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState: FinalConnectionState) => {
      const start = dragConnectionStartRef.current;
      dragConnectionStartRef.current = null;
      if (!start || connectionState.isValid || !start.handleType) return;

      const pointer = getEventPointer(event);
      if (!pointer) return;

      const targetNodeElement =
        getWorkflowNodeElementAtPoint(pointer.clientX, pointer.clientY) ?? getWorkflowNodeElementById(connectionState.toNode?.id);
      const targetId = targetNodeElement?.dataset.id;
      if (!targetNodeElement || !targetId || targetId === start.nodeId) return;

      const tileElement = targetNodeElement.querySelector<HTMLElement>(".node-tile") ?? targetNodeElement;
      const targetSide = getClosestSide(pointer.clientX, pointer.clientY, tileElement.getBoundingClientRect());

      if (start.handleType === "source") {
        addEdge(start.nodeId, targetId, "data", {
          sourceHandle: start.handleId,
          targetHandle: getHandleIdForSide(targetSide, "target")
        });
        return;
      }

      addEdge(targetId, start.nodeId, "data", {
        sourceHandle: getHandleIdForSide(targetSide, "source"),
        targetHandle: start.handleId
      });
    },
    [addEdge]
  );

  const beginEndpointDrag = useCallback(
    (edgeId: string, endpoint: "source" | "target", event: ReactPointerEvent<HTMLElement>) => {
      const edge = workflow.edges.find((item) => item.id === edgeId);
      const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
      const fixedNode = edge ? nodesById.get(endpoint === "source" ? edge.target : edge.source) : null;
      if (!edge || !fixedNode) return;

      const fixedKind = endpoint === "source" ? "target" : "source";
      const fixedHandle = endpoint === "source" ? edge.targetHandle : edge.sourceHandle;
      const fixedPoint = getHandlePoint(fixedNode.position, fixedHandle, fixedKind);
      const shellElement = event.currentTarget.closest<HTMLElement>(".canvas-shell") ?? event.currentTarget;
      const shellRect = shellElement.getBoundingClientRect();
      const nextDrag: EdgeEndpointDrag = {
        edgeId: edge.id,
        endpoint,
        fixedPoint: { x: fixedPoint.x * viewport.zoom + viewport.x, y: fixedPoint.y * viewport.zoom + viewport.y },
        fixedSide: fixedPoint.side,
        currentPoint: toLocalPoint({ x: event.clientX, y: event.clientY }, shellRect)
      };

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      select({ type: "edge", id: edge.id });
      edgeEndpointDragRef.current = nextDrag;
      setEdgeEndpointDrag(nextDrag);
      setConnectionTarget(null);
    },
    [select, viewport, workflow.edges, workflow.nodes]
  );

  const beginEndpointBranch = useCallback(
    (edgeId: string, endpoint: "source" | "target", event: ReactPointerEvent<HTMLElement>) => {
      const edge = workflow.edges.find((item) => item.id === edgeId);
      const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
      const startNode = edge ? nodesById.get(endpoint === "source" ? edge.source : edge.target) : null;
      if (!edge || !startNode) return;

      const handleType = endpoint === "source" ? "source" : "target";
      const handleId = endpoint === "source" ? edge.sourceHandle : edge.targetHandle;
      const startPoint = getHandlePoint(startNode.position, handleId, handleType);
      const shellElement = event.currentTarget.closest<HTMLElement>(".canvas-shell") ?? event.currentTarget;
      const shellRect = shellElement.getBoundingClientRect();
      const nextDraft: DraftConnection = {
        nodeId: startNode.id,
        handleId: handleId ?? (handleType === "source" ? "out" : "in"),
        handleType,
        startPoint: { x: startPoint.x * viewport.zoom + viewport.x, y: startPoint.y * viewport.zoom + viewport.y },
        currentPoint: toLocalPoint({ x: event.clientX, y: event.clientY }, shellRect)
      };

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      select({ type: "edge", id: edge.id });
      draftConnectionRef.current = nextDraft;
      edgeEndpointDragRef.current = null;
      setEdgeEndpointDrag(null);
      setConnectionTarget(null);
      setDraftConnection(nextDraft);
    },
    [select, viewport, workflow.edges, workflow.nodes]
  );

  const deleteEndpointEdge = useCallback(
    (edgeId: string) => {
      removeEdge(edgeId);
      setHoveredEndpointEdgeId("");
      if (selectedItem.type === "edge" && selectedItem.id === edgeId) {
        select({ type: "workflow", id: workflow.id });
      }
    },
    [removeEdge, select, selectedItem, workflow.id]
  );

  const onCanvasPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const edgeEndpointElement = (event.target as Element | null)?.closest?.(".edge-endpoint-control") as HTMLElement | null;
    if (edgeEndpointElement) return;

    const edgeHitElement = (event.target as Element | null)?.closest?.(".model-edge-hit") as HTMLElement | null;
    const hitEdgeId = edgeHitElement?.dataset.edgeId;
    if (hitEdgeId) {
      event.stopPropagation();
      select({ type: "edge", id: hitEdgeId });
      return;
    }

    const handleElement = (event.target as Element | null)?.closest?.(".node-handle") as HTMLElement | null;
    const nodeElement = handleElement?.closest<HTMLElement>(".react-flow__node-workflowNode");
    const nodeId = nodeElement?.dataset.id;
    const handleType: DraftConnection["handleType"] | null = handleElement?.classList.contains("source")
      ? "source"
      : handleElement?.classList.contains("target")
        ? "target"
        : null;
    if (!handleElement || !nodeId || !handleType) return;

    const shellRect = event.currentTarget.getBoundingClientRect();
    const handleRect = handleElement.getBoundingClientRect();
    const startPoint = toLocalPoint(
      {
        x: handleRect.left + handleRect.width / 2,
        y: handleRect.top + handleRect.height / 2
      },
      shellRect
    );
    const nextDraft = {
      nodeId,
      handleId: handleElement.getAttribute("data-handleid"),
      handleType,
      startPoint,
      currentPoint: toLocalPoint({ x: event.clientX, y: event.clientY }, shellRect)
    };

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draftConnectionRef.current = nextDraft;
    setConnectionTarget(null);
    setDraftConnection(nextDraft);
  }, [select]);

  const onCanvasPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const endpointDrag = edgeEndpointDragRef.current;
    if (endpointDrag) {
      const shellRect = event.currentTarget.getBoundingClientRect();
      const nextDrag = { ...endpointDrag, currentPoint: toLocalPoint({ x: event.clientX, y: event.clientY }, shellRect) };
      const targetNodeElement = getWorkflowNodeElementAtPoint(event.clientX, event.clientY);
      const targetId = targetNodeElement?.dataset.id;
      const edge = workflow.edges.find((item) => item.id === endpointDrag.edgeId);
      const invalidSelfConnect =
        edge && ((endpointDrag.endpoint === "source" && targetId === edge.target) || (endpointDrag.endpoint === "target" && targetId === edge.source));

      if (targetNodeElement && targetId && !invalidSelfConnect) {
        const tileElement = targetNodeElement.querySelector<HTMLElement>(".node-tile") ?? targetNodeElement;
        setConnectionTarget({ id: targetId, side: getClosestSide(event.clientX, event.clientY, tileElement.getBoundingClientRect()) });
      } else {
        setConnectionTarget(null);
      }
      edgeEndpointDragRef.current = nextDrag;
      setEdgeEndpointDrag(nextDrag);
      return;
    }

    const draft = draftConnectionRef.current;
    if (!draft) return;
    const shellRect = event.currentTarget.getBoundingClientRect();
    const nextDraft = { ...draft, currentPoint: toLocalPoint({ x: event.clientX, y: event.clientY }, shellRect) };
    const targetNodeElement = getWorkflowNodeElementAtPoint(event.clientX, event.clientY);
    const targetId = targetNodeElement?.dataset.id;
    if (targetNodeElement && targetId && targetId !== draft.nodeId) {
      const tileElement = targetNodeElement.querySelector<HTMLElement>(".node-tile") ?? targetNodeElement;
      setConnectionTarget({ id: targetId, side: getClosestSide(event.clientX, event.clientY, tileElement.getBoundingClientRect()) });
    } else {
      setConnectionTarget(null);
    }
    draftConnectionRef.current = nextDraft;
    setDraftConnection(nextDraft);
  }, [workflow.edges]);

  const onCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const endpointDrag = edgeEndpointDragRef.current;
      if (endpointDrag) {
        const edge = workflow.edges.find((item) => item.id === endpointDrag.edgeId);
        const targetNodeElement = getWorkflowNodeElementAtPoint(event.clientX, event.clientY);
        const targetId = targetNodeElement?.dataset.id;

        if (edge && targetNodeElement && targetId) {
          const tileElement = targetNodeElement.querySelector<HTMLElement>(".node-tile") ?? targetNodeElement;
          const side = getClosestSide(event.clientX, event.clientY, tileElement.getBoundingClientRect());
          if (endpointDrag.endpoint === "source" && targetId !== edge.target) {
            updateEdge(edge.id, { source: targetId, sourceHandle: getHandleIdForSide(side, "source") });
          }
          if (endpointDrag.endpoint === "target" && targetId !== edge.source) {
            updateEdge(edge.id, { target: targetId, targetHandle: getHandleIdForSide(side, "target") });
          }
        }

        edgeEndpointDragRef.current = null;
        setEdgeEndpointDrag(null);
        setConnectionTarget(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      const draft = draftConnectionRef.current;
      if (!draft) return;

      const targetNodeElement = getWorkflowNodeElementAtPoint(event.clientX, event.clientY);
      const targetId = targetNodeElement?.dataset.id;
      if (targetNodeElement && targetId && targetId !== draft.nodeId) {
        const tileElement = targetNodeElement.querySelector<HTMLElement>(".node-tile") ?? targetNodeElement;
        const targetSide = getClosestSide(event.clientX, event.clientY, tileElement.getBoundingClientRect());
        if (draft.handleType === "source") {
          addEdge(draft.nodeId, targetId, "data", {
            sourceHandle: draft.handleId,
            targetHandle: getHandleIdForSide(targetSide, "target")
          });
        } else {
          addEdge(targetId, draft.nodeId, "data", {
            sourceHandle: getHandleIdForSide(targetSide, "source"),
            targetHandle: draft.handleId
          });
        }
      }

      draftConnectionRef.current = null;
      setDraftConnection(null);
      setConnectionTarget(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [addEdge, updateEdge, workflow.edges]
  );

  const onCanvasPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    draftConnectionRef.current = null;
    edgeEndpointDragRef.current = null;
    setDraftConnection(null);
    setEdgeEndpointDrag(null);
    setConnectionTarget(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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
      data-flow-edge-count={edges.length}
      onPointerDownCapture={onCanvasPointerDownCapture}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onPointerCancel={onCanvasPointerCancel}
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
          <strong>Start designing your flow</strong>
          <span>Drag a node from the library or open an AI workflow or approval-chain sample.</span>
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
      <ModelEdgeLayer workflow={workflow} viewport={viewport} focusedNodeId={focusedNodeId} selectedEdgeId={focusedEdgeId} />
      <EdgeEndpointControls
        workflow={workflow}
        viewport={viewport}
        selectedEdgeId={selectedItem.type === "edge" ? selectedItem.id : ""}
        activeEdgeId={edgeEndpointDrag?.edgeId ?? ""}
        onEndpointHover={setHoveredEndpointEdgeId}
        onEndpointPointerDown={beginEndpointDrag}
        onEndpointBranchPointerDown={beginEndpointBranch}
        onEndpointDelete={deleteEndpointEdge}
      />
      <DraftConnectionLayer connection={draftConnection} />
      <EndpointDragLayer drag={edgeEndpointDrag} target={connectionTarget} />
      <ReactFlow
        key={workflow.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={beginMove}
        onNodeDragStop={endMove}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={(_, node) => select({ type: workflow.groups.some((group) => group.id === node.id) ? "group" : "node", id: node.id })}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId("")}
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

function EdgeEndpointControls({
  workflow,
  viewport,
  selectedEdgeId,
  activeEdgeId,
  onEndpointHover,
  onEndpointPointerDown,
  onEndpointBranchPointerDown,
  onEndpointDelete
}: {
  workflow: Workflow;
  viewport: { x: number; y: number; zoom: number };
  selectedEdgeId: string;
  activeEdgeId: string;
  onEndpointHover: (edgeId: string) => void;
  onEndpointPointerDown: (edgeId: string, endpoint: "source" | "target", event: ReactPointerEvent<HTMLElement>) => void;
  onEndpointBranchPointerDown: (edgeId: string, endpoint: "source" | "target", event: ReactPointerEvent<HTMLElement>) => void;
  onEndpointDelete: (edgeId: string) => void;
}) {
  const nodesById = useMemo(() => new Map(workflow.nodes.map((node) => [node.id, node])), [workflow.nodes]);
  const endpoints = useMemo(() => {
    const rawEndpoints = workflow.edges.flatMap((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return [];
      const sourcePoint = getHandlePoint(source.position, edge.sourceHandle, "source");
      const targetPoint = getHandlePoint(target.position, edge.targetHandle, "target");
      return [
        {
          edgeId: edge.id,
          endpoint: "source" as const,
          selected: edge.id === selectedEdgeId,
          visible: edge.id === activeEdgeId,
          x: sourcePoint.x * viewport.zoom + viewport.x,
          y: sourcePoint.y * viewport.zoom + viewport.y,
          side: sourcePoint.side,
          label: edge.label || edge.id
        },
        {
          edgeId: edge.id,
          endpoint: "target" as const,
          selected: edge.id === selectedEdgeId,
          visible: edge.id === activeEdgeId,
          x: targetPoint.x * viewport.zoom + viewport.x,
          y: targetPoint.y * viewport.zoom + viewport.y,
          side: targetPoint.side,
          label: edge.label || edge.id
        }
      ];
    });

    const groups = new Map<string, typeof rawEndpoints>();
    for (const endpoint of rawEndpoints) {
      const key = `${Math.round(endpoint.x)}:${Math.round(endpoint.y)}`;
      groups.set(key, [...(groups.get(key) ?? []), endpoint]);
    }

    return rawEndpoints.map((endpoint) => {
      const siblings = groups.get(`${Math.round(endpoint.x)}:${Math.round(endpoint.y)}`) ?? [endpoint];
      const stackIndex = siblings.findIndex((sibling) => sibling.edgeId === endpoint.edgeId && sibling.endpoint === endpoint.endpoint);
      const position = getStackedEndpointPosition(endpoint.x, endpoint.y, endpoint.side, stackIndex, siblings.length);
      return { ...endpoint, ...position, stackCount: siblings.length, stackIndex };
    });
  }, [activeEdgeId, nodesById, selectedEdgeId, viewport.x, viewport.y, viewport.zoom, workflow.edges]);

  if (!endpoints.length) return null;

  return (
    <div className="workflow-edge-endpoints">
      {endpoints.map((endpoint) => (
        <div
          key={`${endpoint.edgeId}-${endpoint.endpoint}`}
          className={`edge-endpoint-control ${endpoint.endpoint} ${endpoint.visible ? "is-visible" : ""} ${endpoint.selected ? "is-selected" : ""}`}
          data-edge-id={endpoint.edgeId}
          data-endpoint={endpoint.endpoint}
          data-side={endpoint.side}
          data-stack-count={endpoint.stackCount}
          data-stack-index={endpoint.stackIndex}
          style={{ left: endpoint.x, top: endpoint.y }}
          onPointerEnter={() => onEndpointHover(endpoint.edgeId)}
          onPointerLeave={() => onEndpointHover("")}
        >
          <button
            type="button"
            className="edge-endpoint-handle"
            data-edge-id={endpoint.edgeId}
            data-endpoint={endpoint.endpoint}
            tabIndex={-1}
            title={`${endpoint.endpoint === "source" ? "Move source" : "Move target"}: ${endpoint.label}`}
            onPointerDown={(event) => onEndpointPointerDown(endpoint.edgeId, endpoint.endpoint, event)}
          />
          <div className="edge-endpoint-actions" aria-label={`Actions for ${endpoint.label}`}>
            <button
              type="button"
              className="edge-endpoint-action add"
              aria-label={`${endpoint.endpoint === "source" ? "Add outgoing edge from" : "Add incoming edge to"} ${endpoint.label}`}
              title={endpoint.endpoint === "source" ? "Add another outgoing edge" : "Add another incoming edge"}
              onPointerDown={(event) => onEndpointBranchPointerDown(endpoint.edgeId, endpoint.endpoint, event)}
            >
              +
            </button>
            <button
              type="button"
              className="edge-endpoint-action remove"
              aria-label={`Delete ${endpoint.label}`}
              title="Delete edge"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEndpointDelete(endpoint.edgeId);
              }}
            >
              -
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftConnectionLayer({ connection }: { connection: DraftConnection | null }) {
  if (!connection) return null;
  const side = getHandleSide(connection.handleId ?? undefined, connection.handleType);
  const path = buildDraftPath(connection.startPoint.x, connection.startPoint.y, connection.currentPoint.x, connection.currentPoint.y, side);

  return (
    <svg className="workflow-draft-connection" aria-hidden="true">
      <path d={path} />
      <circle cx={connection.currentPoint.x} cy={connection.currentPoint.y} r="3.5" />
    </svg>
  );
}

function EndpointDragLayer({ drag, target }: { drag: EdgeEndpointDrag | null; target: ConnectionTarget | null }) {
  if (!drag) return null;
  const sourcePoint = drag.endpoint === "source" ? drag.currentPoint : drag.fixedPoint;
  const targetPoint = drag.endpoint === "source" ? drag.fixedPoint : drag.currentPoint;
  const sourceSide = drag.endpoint === "source" ? target?.side ?? getOppositeSide(drag.fixedSide) : drag.fixedSide;
  const targetSide = drag.endpoint === "source" ? drag.fixedSide : target?.side ?? getOppositeSide(drag.fixedSide);
  const path = buildEdgePath(sourcePoint.x, sourcePoint.y, sourceSide, targetPoint.x, targetPoint.y, targetSide, 0.42);

  return (
    <svg className="workflow-draft-connection" aria-hidden="true">
      <path d={path} />
      <circle cx={drag.currentPoint.x} cy={drag.currentPoint.y} r="3.5" />
    </svg>
  );
}

function ModelEdgeLayer({
  workflow,
  viewport,
  focusedNodeId,
  selectedEdgeId
}: {
  workflow: Workflow;
  viewport: { x: number; y: number; zoom: number };
  focusedNodeId: string;
  selectedEdgeId: string;
}) {
  const nodesById = useMemo(() => new Map(workflow.nodes.map((node) => [node.id, node])), [workflow.nodes]);
  const edges = workflow.edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return null;
      const sourcePoint = getHandlePoint(source.position, edge.sourceHandle, "source");
      const targetPoint = getHandlePoint(target.position, edge.targetHandle, "target");
      const sourceX = sourcePoint.x * viewport.zoom + viewport.x;
      const sourceY = sourcePoint.y * viewport.zoom + viewport.y;
      const targetX = targetPoint.x * viewport.zoom + viewport.x;
      const targetY = targetPoint.y * viewport.zoom + viewport.y;
      const path = buildEdgePath(sourceX, sourceY, sourcePoint.side, targetX, targetY, targetPoint.side, edge.curvature ?? 0.42);
      const isRelated = Boolean(focusedNodeId && (edge.source === focusedNodeId || edge.target === focusedNodeId));
      const isSelected = edge.id === selectedEdgeId;
      return { id: edge.id, type: edge.type, path, isRelated, isSelected, isMuted: Boolean(focusedNodeId && !isRelated) };
    })
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));

  if (!edges.length) return null;

  return (
    <svg className="workflow-model-edges" aria-hidden="true">
      <defs>
        <marker id="workflow-model-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <g key={edge.id} className={`model-edge ${edge.type} ${edge.isRelated ? "is-related" : ""} ${edge.isSelected ? "is-selected" : ""} ${edge.isMuted ? "is-muted" : ""}`}>
          <path d={edge.path} markerEnd="url(#workflow-model-arrow)" />
          <path className="model-edge-hit" data-edge-id={edge.id} d={edge.path} />
        </g>
      ))}
    </svg>
  );
}

function getHandlePoint(position: { x: number; y: number }, handleId: string | undefined, kind: "source" | "target") {
  const side = getHandleSide(handleId, kind);
  if (side === "top") {
    return { x: position.x + WORKFLOW_NODE_CENTER_X, y: position.y + NODE_TILE_TOP_Y, side };
  }
  if (side === "bottom") {
    return { x: position.x + WORKFLOW_NODE_CENTER_X, y: position.y + NODE_TILE_BOTTOM_Y, side };
  }
  if (side === "right") {
    return { x: position.x + NODE_TILE_RIGHT_X, y: position.y + NODE_TILE_CENTER_Y, side };
  }
  return { x: position.x + NODE_TILE_LEFT_X, y: position.y + NODE_TILE_CENTER_Y, side };
}

function getHandleSide(handleId: string | undefined, kind: "source" | "target") {
  if (handleId?.endsWith("-top")) return "top" as const;
  if (handleId?.endsWith("-right")) return "right" as const;
  if (handleId?.endsWith("-bottom")) return "bottom" as const;
  if (handleId?.endsWith("-left")) return "left" as const;
  return kind === "source" ? ("right" as const) : ("left" as const);
}

function getHandleIdForSide(side: ConnectionSide, kind: "source" | "target") {
  if (kind === "source") {
    if (side === "left") return "out-left";
    if (side === "top") return "out-top";
    if (side === "bottom") return "out-bottom";
    return "out";
  }
  if (side === "right") return "in-right";
  if (side === "top") return "in-top";
  if (side === "bottom") return "in-bottom";
  return "in";
}

function getStackedEndpointPosition(x: number, y: number, side: ConnectionSide, index: number, count: number) {
  if (count <= 1 || index < 0) return { x, y };
  const offset = (index - (count - 1) / 2) * 12;
  if (side === "top" || side === "bottom") {
    return { x: x + offset, y };
  }
  return { x, y: y + offset };
}

function getEventPointer(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

function getWorkflowNodeElementAtPoint(clientX: number, clientY: number) {
  return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".react-flow__node-workflowNode");
}

function getWorkflowNodeElementById(id: string | undefined) {
  if (!id) return null;
  return document.querySelector<HTMLElement>(`.react-flow__node-workflowNode[data-id="${CSS.escape(id)}"]`);
}

function toLocalPoint(point: { x: number; y: number }, rect: DOMRect) {
  return { x: point.x - rect.left, y: point.y - rect.top };
}

function getClosestSide(clientX: number, clientY: number, rect: DOMRect): ConnectionSide {
  const distances = [
    { side: "left" as const, value: Math.abs(clientX - rect.left) },
    { side: "right" as const, value: Math.abs(clientX - rect.right) },
    { side: "top" as const, value: Math.abs(clientY - rect.top) },
    { side: "bottom" as const, value: Math.abs(clientY - rect.bottom) }
  ];
  return distances.reduce((closest, next) => (next.value < closest.value ? next : closest)).side;
}

function buildEdgePath(
  sourceX: number,
  sourceY: number,
  sourceSide: ConnectionSide,
  targetX: number,
  targetY: number,
  targetSide: ConnectionSide,
  curvature: number
) {
  const clampedCurvature = clamp(curvature, 0, 1);
  if (clampedCurvature === 0) return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  const distance = Math.hypot(targetX - sourceX, targetY - sourceY);
  const offset = Math.max(12, Math.min(220, distance * (0.18 + clampedCurvature * 0.62)));
  const sourceNormal = getSideNormal(sourceSide);
  const targetNormal = getSideNormal(targetSide);
  const controlSource = { x: sourceX + sourceNormal.x * offset, y: sourceY + sourceNormal.y * offset };
  const controlTarget = { x: targetX + targetNormal.x * offset, y: targetY + targetNormal.y * offset };
  return `M ${sourceX} ${sourceY} C ${controlSource.x} ${controlSource.y}, ${controlTarget.x} ${controlTarget.y}, ${targetX} ${targetY}`;
}

function buildDraftPath(sourceX: number, sourceY: number, targetX: number, targetY: number, side: ConnectionSide) {
  const horizontalDistance = Math.max(44, Math.abs(targetX - sourceX) * 0.45);
  const verticalDistance = Math.max(44, Math.abs(targetY - sourceY) * 0.45);
  if (side === "left") {
    const midX = sourceX - horizontalDistance;
    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  }
  if (side === "top") {
    const midY = sourceY - verticalDistance;
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
  }
  if (side === "bottom") {
    const midY = sourceY + verticalDistance;
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
  }
  const midX = sourceX + horizontalDistance;
  return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
}

function getSideNormal(side: ConnectionSide) {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function getOppositeSide(side: ConnectionSide): ConnectionSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
