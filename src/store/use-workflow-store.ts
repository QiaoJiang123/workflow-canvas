"use client";

import type { ApprovalChainType, EdgeKind, ReviewDocument, ValidationIssue, Workflow, WorkflowEdge, WorkflowGroup, WorkflowNode, WorkflowStatus } from "@/domain/types";
import { createInsuranceClaimSeveritySample } from "@/domain/samples";
import { createEmptyWorkflow, createNodeFromDefinitionId, duplicateWorkflow, getDefaultStageColor, newId, touchWorkflow } from "@/domain/workflow-factory";
import { validateWorkflow } from "@/domain/validation";
import { create } from "zustand";

type SelectedItem =
  | { type: "workflow"; id: string }
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | { type: "group"; id: string };

type SaveStatus = "idle" | "saving" | "saved" | "error";
type WorkflowMetaPatch = Partial<
  Pick<Workflow, "name" | "description" | "owner" | "team" | "status" | "tags" | "version" | "reviewDocuments">
> & {
  approvalChainType?: ApprovalChainType;
};
type AddNodeOptions = Partial<Pick<WorkflowNode["data"], "label" | "description" | "owner" | "status" | "technology" | "tags" | "notes" | "documentationUrl">> & {
  configuration?: Record<string, unknown>;
};

interface EditorState {
  workflow: Workflow;
  selectedItem: SelectedItem;
  validationIssues: ValidationIssue[];
  search: string;
  libraryCollapsed: boolean;
  inspectorCollapsed: boolean;
  inspectorExpanded: boolean;
  validationOpen: boolean;
  theme: "light" | "dark";
  saveStatus: SaveStatus;
  past: Workflow[];
  future: Workflow[];
  dragStart: Workflow | null;
  clipboardNode: WorkflowNode | null;
  setWorkflow: (workflow: Workflow, resetHistory?: boolean) => void;
  updateWorkflowMeta: (patch: WorkflowMetaPatch) => void;
  addWorkflowDocument: (document: ReviewDocument) => void;
  linkDocumentToNodes: (document: ReviewDocument, nodeIds: string[]) => void;
  unlinkDocumentFromNode: (documentId: string, nodeId: string) => void;
  addNode: (definitionId: string, position?: { x: number; y: number }, options?: AddNodeOptions) => void;
  updateNode: (id: string, patch: Partial<WorkflowNode["data"]>) => void;
  updateNodeConfiguration: (id: string, key: string, value: unknown) => void;
  addEdge: (source: string, target: string, type?: EdgeKind, handles?: { sourceHandle?: string | null; targetHandle?: string | null }) => void;
  updateEdge: (id: string, patch: Partial<WorkflowEdge>) => void;
  removeEdge: (id: string) => void;
  addGroup: () => void;
  updateGroup: (id: string, patch: Partial<WorkflowGroup>) => void;
  moveItemLive: (id: string, position: { x: number; y: number }) => void;
  resizeGroupLive: (id: string, width: number, height: number) => void;
  beginMove: () => void;
  endMove: () => void;
  select: (item: SelectedItem) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  clearSelection: () => void;
  moveSelectedGroupLayer: (direction: "forward" | "backward") => void;
  undo: () => void;
  redo: () => void;
  validate: () => void;
  clear: () => void;
  loadSample: () => void;
  autoLayout: () => void;
  setSearch: (search: string) => void;
  setSaveStatus: (saveStatus: SaveStatus) => void;
  toggleTheme: () => void;
  toggleLibrary: () => void;
  toggleInspector: () => void;
  toggleInspectorExpanded: () => void;
  toggleValidation: () => void;
}

const HISTORY_LIMIT = 60;

export const useWorkflowStore = create<EditorState>((set, get) => {
  const initial = createInsuranceClaimSeveritySample();
  return {
    workflow: initial,
    selectedItem: { type: "workflow", id: initial.id },
    validationIssues: validateWorkflow(initial),
    search: "",
    libraryCollapsed: false,
    inspectorCollapsed: false,
    inspectorExpanded: false,
    validationOpen: true,
    theme: "light",
    saveStatus: "idle",
    past: [],
    future: [],
    dragStart: null,
    clipboardNode: null,
    setWorkflow: (workflow, resetHistory = false) =>
      set({
        workflow,
        selectedItem: { type: "workflow", id: workflow.id },
        validationIssues: validateWorkflow(workflow),
        past: resetHistory ? [] : get().past,
        future: resetHistory ? [] : get().future
      }),
    updateWorkflowMeta: (patch) => commit(set, get, (workflow) => applyWorkflowMetaPatch(workflow, patch)),
    addWorkflowDocument: (document) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        reviewDocuments: dedupeDocuments([...(workflow.reviewDocuments ?? []), document])
      })),
    linkDocumentToNodes: (document, nodeIds) =>
      commit(set, get, (workflow) => {
        const selectedIds = new Set(nodeIds);
        return {
          ...workflow,
          reviewDocuments: dedupeDocuments([...(workflow.reviewDocuments ?? []), document]),
          nodes: workflow.nodes.map((node) => {
            if (!selectedIds.has(node.id)) return node;
            const existing = Array.isArray(node.data.configuration.documents) ? node.data.configuration.documents.filter(isReviewDocument) : [];
            return {
              ...node,
              data: {
                ...node.data,
                configuration: {
                  ...node.data.configuration,
                  documents: dedupeDocuments([...existing, document])
                }
              }
            };
          })
        };
      }),
    unlinkDocumentFromNode: (documentId, nodeId) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const existing = Array.isArray(node.data.configuration.documents) ? node.data.configuration.documents.filter(isReviewDocument) : [];
          return {
            ...node,
            data: {
              ...node.data,
              configuration: {
                ...node.data.configuration,
                documents: existing.filter((document) => document.id !== documentId)
              }
            }
          };
        })
      })),
    addNode: (definitionId, position = { x: 220, y: 220 }, options = {}) =>
      commit(set, get, (workflow) => {
        const node = createNodeFromDefinitionId(definitionId, position);
        return {
          ...workflow,
          nodes: [
            ...workflow.nodes,
            {
              ...node,
              data: {
                ...node.data,
                ...options,
                configuration: { ...node.data.configuration, ...(options.configuration ?? {}) }
              }
            }
          ]
        };
      }),
    updateNode: (id, patch) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
      })),
    updateNodeConfiguration: (id, key, value) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, configuration: { ...node.data.configuration, [key]: value } } }
            : node
        )
      })),
    addEdge: (source, target, type = "data", handles) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        edges: [
          ...workflow.edges,
          {
            id: newId("edge"),
            source,
            target,
            sourceHandle: handles?.sourceHandle ?? "out",
            targetHandle: handles?.targetHandle ?? "in",
            type,
            label: type === "data" ? "Data" : type,
            curvature: 0.42
          }
        ]
      })),
    updateEdge: (id, patch) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        edges: workflow.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge))
      })),
    removeEdge: (id) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        edges: workflow.edges.filter((edge) => edge.id !== id)
      })),
    addGroup: () =>
      commit(set, get, (workflow) => {
        const defaultColor = getDefaultStageColor(workflow.groups.length);
        return {
          ...workflow,
          groups: [
            ...workflow.groups,
            {
              id: newId("group"),
              title: "New stage",
              description: "",
              position: { x: 120, y: 120 },
              width: 320,
              height: 420,
              color: defaultColor,
              defaultColor
            }
          ]
        };
      }),
    updateGroup: (id, patch) =>
      commit(set, get, (workflow) => ({
        ...workflow,
        groups: workflow.groups.map((group) => (group.id === id ? { ...group, ...patch } : group))
      })),
    moveItemLive: (id, position) =>
      set((state) => ({
        workflow: {
          ...state.workflow,
          nodes: state.workflow.nodes.map((node) => (node.id === id ? { ...node, position } : node)),
          groups: state.workflow.groups.map((group) => (group.id === id ? { ...group, position } : group))
        }
      })),
    resizeGroupLive: (id, width, height) =>
      set((state) => ({
        workflow: {
          ...state.workflow,
          groups: state.workflow.groups.map((group) => (group.id === id ? { ...group, width, height } : group))
        }
      })),
    beginMove: () => set({ dragStart: cloneWorkflow(get().workflow) }),
    endMove: () => {
      const { dragStart, workflow, past } = get();
      if (!dragStart) return;
      set({
        workflow: touchWorkflow(workflow),
        past: [dragStart, ...past].slice(0, HISTORY_LIMIT),
        future: [],
        dragStart: null,
        validationIssues: validateWorkflow(workflow)
      });
    },
    select: (item) => set({ selectedItem: item }),
    deleteSelected: () => {
      const selected = get().selectedItem;
      if (selected.type === "workflow") return;
      commit(set, get, (workflow) => {
        if (selected.type === "node") {
          return {
            ...workflow,
            nodes: workflow.nodes.filter((node) => node.id !== selected.id),
            edges: workflow.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id)
          };
        }
        if (selected.type === "edge") {
          return { ...workflow, edges: workflow.edges.filter((edge) => edge.id !== selected.id) };
        }
        return { ...workflow, groups: workflow.groups.filter((group) => group.id !== selected.id) };
      });
      set({ selectedItem: { type: "workflow", id: get().workflow.id } });
    },
    duplicateSelected: () => {
      const selected = get().selectedItem;
      if (selected.type === "workflow") {
        setWorkflowFromAction(set, get, duplicateWorkflow(get().workflow));
        return;
      }
      if (selected.type !== "node") return;
      const node = get().workflow.nodes.find((item) => item.id === selected.id);
      if (!node) return;
      const copy = {
        ...node,
        id: newId("node"),
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        data: { ...node.data, label: `${node.data.label} copy`, configuration: { ...node.data.configuration } }
      };
      commit(set, get, (workflow) => ({ ...workflow, nodes: [...workflow.nodes, copy] }));
      set({ selectedItem: { type: "node", id: copy.id } });
    },
    copySelected: () => {
      const selected = get().selectedItem;
      if (selected.type !== "node") return;
      const node = get().workflow.nodes.find((item) => item.id === selected.id);
      if (node) set({ clipboardNode: cloneNode(node) });
    },
    pasteClipboard: () => {
      const clipboardNode = get().clipboardNode;
      if (!clipboardNode) return;
      const copy = {
        ...cloneNode(clipboardNode),
        id: newId("node"),
        position: { x: clipboardNode.position.x + 56, y: clipboardNode.position.y + 56 },
        data: {
          ...clipboardNode.data,
          label: clipboardNode.data.label.endsWith(" copy") ? clipboardNode.data.label : `${clipboardNode.data.label} copy`,
          configuration: { ...clipboardNode.data.configuration },
          tags: [...(clipboardNode.data.tags ?? [])]
        }
      };
      commit(set, get, (workflow) => ({ ...workflow, nodes: [...workflow.nodes, copy] }));
      set({ selectedItem: { type: "node", id: copy.id }, clipboardNode: copy });
    },
    clearSelection: () => set({ selectedItem: { type: "workflow", id: get().workflow.id } }),
    moveSelectedGroupLayer: (direction) => {
      const selected = get().selectedItem;
      if (selected.type !== "group") return;
      commit(set, get, (workflow) => {
        const index = workflow.groups.findIndex((group) => group.id === selected.id);
        if (index < 0) return workflow;
        const targetIndex = direction === "forward" ? Math.min(workflow.groups.length - 1, index + 1) : Math.max(0, index - 1);
        if (targetIndex === index) return workflow;
        const groups = [...workflow.groups];
        const [group] = groups.splice(index, 1);
        groups.splice(targetIndex, 0, group);
        return { ...workflow, groups };
      });
    },
    undo: () => {
      const { past, workflow, future } = get();
      const [previous, ...rest] = past;
      if (!previous) return;
      set({
        workflow: previous,
        past: rest,
        future: [workflow, ...future].slice(0, HISTORY_LIMIT),
        validationIssues: validateWorkflow(previous),
        selectedItem: { type: "workflow", id: previous.id }
      });
    },
    redo: () => {
      const { future, workflow, past } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({
        workflow: next,
        future: rest,
        past: [workflow, ...past].slice(0, HISTORY_LIMIT),
        validationIssues: validateWorkflow(next),
        selectedItem: { type: "workflow", id: next.id }
      });
    },
    validate: () => set({ validationIssues: validateWorkflow(get().workflow), validationOpen: true }),
    clear: () => setWorkflowFromAction(set, get, createEmptyWorkflow("Untitled workflow")),
    loadSample: () => setWorkflowFromAction(set, get, createInsuranceClaimSeveritySample()),
    autoLayout: () =>
      commit(set, get, (workflow) => {
        const categoryOrder = [
          "data_sources",
          "data_processing",
          "feature_engineering",
          "machine_learning",
          "evaluation",
          "deployment",
          "monitoring",
          "human_review",
          "outputs",
          "documentation"
        ];
        const nextGroups = workflow.groups.map((group, index) => ({
          ...group,
          position: { x: 80 + index * 320, y: 80 },
          width: 280,
          height: 520
        }));
        const categoryCounts = new Map<string, number>();
        const nodes = workflow.nodes.map((node) => {
          const column = Math.max(0, categoryOrder.indexOf(node.data.category));
          const row = categoryCounts.get(node.data.category) ?? 0;
          categoryCounts.set(node.data.category, row + 1);
          return {
            ...node,
            position: { x: 140 + column * 260, y: 160 + row * 155 }
          };
        });
        return { ...workflow, groups: nextGroups, nodes };
      }),
    setSearch: (search) => set({ search }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    toggleLibrary: () => set((state) => ({ libraryCollapsed: !state.libraryCollapsed })),
    toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
    toggleInspectorExpanded: () => set((state) => ({ inspectorExpanded: !state.inspectorExpanded, inspectorCollapsed: false })),
    toggleValidation: () => set((state) => ({ validationOpen: !state.validationOpen }))
  };
});

function commit(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  updater: (workflow: Workflow) => Workflow
) {
  const current = get().workflow;
  const next = touchWorkflow(updater(cloneWorkflow(current)));
  set({
    workflow: next,
    past: [current, ...get().past].slice(0, HISTORY_LIMIT),
    future: [],
    validationIssues: validateWorkflow(next),
    saveStatus: "idle"
  });
}

function setWorkflowFromAction(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  workflow: Workflow
) {
  const current = get().workflow;
  set({
    workflow,
    selectedItem: { type: "workflow", id: workflow.id },
    past: [current, ...get().past].slice(0, HISTORY_LIMIT),
    future: [],
    validationIssues: validateWorkflow(workflow)
  });
}

function applyWorkflowMetaPatch(workflow: Workflow, patch: WorkflowMetaPatch): Workflow {
  const next = { ...workflow, ...patch };
  if (workflow.flowKind === "approval_chain") {
    return {
      ...next,
      flowKind: "approval_chain",
      approvalChainType: next.approvalChainType ?? workflow.approvalChainType ?? "underwriting"
    };
  }
  return {
    ...next,
    flowKind: "ai_workflow",
    approvalChainType: undefined
  };
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

function cloneNode(node: WorkflowNode): WorkflowNode {
  return JSON.parse(JSON.stringify(node)) as WorkflowNode;
}

function isReviewDocument(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ReviewDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.url === "string" &&
    (document.type === "pdf" || document.type === "doc" || document.type === "text")
  );
}

function dedupeDocuments(documents: ReviewDocument[]) {
  return [...new Map(documents.map((document) => [document.id, document])).values()];
}
