import { getNodeDefinition } from "./node-definitions";
import type { EdgeKind, NodeStatus, Workflow, WorkflowEdge, WorkflowNode } from "./types";
import { createNodeFromDefinitionId, newId, touchWorkflow } from "./workflow-factory";

export type AgentAction =
  | {
      type: "add_node";
      definitionId: string;
      label?: string;
      description?: string;
      technology?: string;
      status?: NodeStatus;
      configuration?: Record<string, unknown>;
      sourceId?: string;
      edgeLabel?: string;
      edgeType?: EdgeKind;
    }
  | {
      type: "add_edge";
      sourceId?: string;
      sourceLabel?: string;
      targetId?: string;
      targetLabel?: string;
      label?: string;
      edgeType?: EdgeKind;
    }
  | {
      type: "update_node";
      nodeId?: string;
      nodeLabel?: string;
      useSelected?: boolean;
      label?: string;
      description?: string;
      technology?: string;
      status?: NodeStatus;
      notes?: string;
      configuration?: Record<string, unknown>;
    }
  | {
      type: "update_workflow";
      name?: string;
      description?: string;
      owner?: string;
      team?: string;
    };

export interface AgentPlan {
  message: string;
  actions: AgentAction[];
  workflow?: Workflow;
}

export function planWorkflowActions(prompt: string, workflow?: Workflow, selected?: { type: string; id: string }): AgentPlan {
  const actions = createLocalActions(prompt, workflow, selected);
  const nextWorkflow = workflow && actions.length ? applyAgentActions(workflow, actions, selected) : workflow;
  const changed = nextWorkflow && workflow ? describeChanges(workflow, nextWorkflow) : [];

  return {
    message: actions.length
      ? `Applied ${actions.length} workflow change${actions.length === 1 ? "" : "s"}: ${changed.join("; ") || "updated the canvas"}.`
      : buildNoActionMessage(prompt),
    actions,
    workflow: nextWorkflow
  };
}

export function applyAgentActions(workflow: Workflow, actions: AgentAction[], selected?: { type: string; id: string }) {
  let next = cloneWorkflow(workflow);
  let previousAddedNodeId = "";

  for (const action of actions) {
    if (action.type === "add_node") {
      const sourceId = action.sourceId === "__previous__" ? previousAddedNodeId : action.sourceId;
      const result = addNode(next, { ...action, sourceId });
      next = result.workflow;
      previousAddedNodeId = result.nodeId || previousAddedNodeId;
    }
    if (action.type === "add_edge") next = addEdge(next, action);
    if (action.type === "update_node") next = updateNode(next, action, selected);
    if (action.type === "update_workflow") {
      next = {
        ...next,
        ...compactPatch({
          name: action.name,
          description: action.description,
          owner: action.owner,
          team: action.team
        })
      };
    }
  }

  return touchWorkflow(next);
}

function createLocalActions(prompt: string, workflow?: Workflow, selected?: { type: string; id: string }) {
  const lower = prompt.toLowerCase();
  const actions: AgentAction[] = [];

  if (/\b(add|insert|create|include)\b/.test(lower)) {
    const requestedDefinitions = inferDefinitions(lower);
    const anchor = selected?.type === "node" ? selected.id : workflow?.nodes.at(-1)?.id;
    requestedDefinitions.forEach((definitionId, index) => {
      actions.push({
        type: "add_node",
        definitionId,
        status: "not_started",
        sourceId: lower.includes("edge") || lower.includes("connect") || lower.includes("after") ? (index === 0 ? anchor : "__previous__") : undefined,
        edgeLabel: "Agent added",
        edgeType: inferEdgeType(lower)
      });
    });
  }

  const connection = inferConnection(prompt, workflow);
  if (connection) actions.push(connection);

  const contentUpdate = inferContentUpdate(prompt, workflow, selected);
  if (contentUpdate) actions.push(contentUpdate);

  if (lower.includes("underwriting") && lower.includes("risk") && !actions.length) {
    actions.push(
      { type: "add_node", definitionId: "data-validation", label: "Underwriting Data Checks", status: "not_started" },
      { type: "add_node", definitionId: "human-review", label: "Underwriting Review", status: "not_started", edgeLabel: "Review exceptions", edgeType: "approval" },
      { type: "add_node", definitionId: "monitoring", label: "Underwriting Drift Monitor", status: "not_started", edgeLabel: "Monitor decisions" }
    );
  }

  return actions.slice(0, 8);
}

function inferDefinitions(lower: string) {
  const matches = new Set<string>();
  const keywordMap: Array<[string[], string]> = [
    [["approval", "approve"], "approval"],
    [["human review", "reviewer"], "human-review"],
    [["guardrail", "policy"], "guardrail"],
    [["monitor", "monitoring", "drift"], "monitoring"],
    [["alert", "notify"], "alert"],
    [["dashboard", "reporting"], "dashboard"],
    [["api endpoint", "endpoint"], "api-endpoint"],
    [["llm", "gpt", "openai"], "llm"],
    [["agent"], "agent"],
    [["tool"], "tool"],
    [["retrieval", "rag"], "rag-retrieval"],
    [["vector"], "vector-db"],
    [["validation", "checks"], "data-validation"],
    [["cleaning", "normalize"], "data-cleaning"],
    [["evaluation", "evaluate"], "model-evaluation"],
    [["registry"], "model-registry"],
    [["batch inference", "scoring"], "batch-inference"],
    [["feedback"], "feedback"]
  ];

  for (const [keywords, definitionId] of keywordMap) {
    if (keywords.some((keyword) => lower.includes(keyword))) matches.add(definitionId);
  }

  if (matches.size) return [...matches];
  if (lower.includes("different node") || lower.includes("nodes")) return ["api-source", "data-validation", "llm", "human-review", "monitoring"];
  return [];
}

function inferConnection(prompt: string, workflow?: Workflow): AgentAction | null {
  if (!workflow) return null;
  const match = prompt.match(/connect\s+(.+?)\s+(?:to|->)\s+(.+?)(?:\.|$)/i);
  if (!match) return null;
  return {
    type: "add_edge",
    sourceLabel: match[1].trim(),
    targetLabel: match[2].trim(),
    label: "Agent connection",
    edgeType: inferEdgeType(prompt.toLowerCase())
  };
}

function inferContentUpdate(prompt: string, workflow?: Workflow, selected?: { type: string; id: string }): AgentAction | null {
  if (!workflow) return null;
  const lower = prompt.toLowerCase();
  const wantsChange = /\b(rename|change|update|set|rewrite)\b/.test(lower) && /\b(content|label|name|description|notes|technology|status|selected|node)\b/.test(lower);
  if (!wantsChange) return null;

  const quoted = [...prompt.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
  const label = lower.includes("rename") || lower.includes("name") || lower.includes("label") ? quoted.at(-1) : undefined;
  const description =
    lower.includes("description") || lower.includes("content") || lower.includes("rewrite")
      ? quoted.at(-1) ?? "Updated by Workflow Copilot agent."
      : undefined;

  return {
    type: "update_node",
    useSelected: selected?.type === "node",
    nodeLabel: !selected || selected.type !== "node" ? inferNodeLabel(prompt, workflow) ?? workflow.nodes[0]?.data.label : undefined,
    label,
    description,
    notes: lower.includes("note") ? quoted.at(-1) : undefined,
    status: inferStatus(lower)
  };
}

function inferNodeLabel(prompt: string, workflow: Workflow) {
  const lower = prompt.toLowerCase();
  return workflow.nodes.find((node) => lower.includes(node.data.label.toLowerCase()))?.data.label;
}

function inferStatus(lower: string): NodeStatus | undefined {
  if (lower.includes("ready")) return "ready";
  if (lower.includes("progress")) return "in_progress";
  if (lower.includes("review")) return "needs_review";
  if (lower.includes("blocked")) return "blocked";
  return undefined;
}

function inferEdgeType(lower: string): EdgeKind {
  if (lower.includes("approval")) return "approval";
  if (lower.includes("feedback")) return "feedback";
  if (lower.includes("control")) return "control";
  if (lower.includes("dependency")) return "dependency";
  return "data";
}

function addNode(workflow: Workflow, action: Extract<AgentAction, { type: "add_node" }>) {
  const definition = getNodeDefinition(action.definitionId);
  if (!definition) return { workflow, nodeId: "" };
  const position = nextNodePosition(workflow);
  const node = createNodeFromDefinitionId(definition.id, position);
  node.data = {
    ...node.data,
    label: action.label || node.data.label,
    description: action.description ?? node.data.description,
    technology: action.technology ?? node.data.technology,
    status: action.status ?? node.data.status,
    configuration: { ...node.data.configuration, ...(action.configuration ?? {}) }
  };
  const nodes = [...workflow.nodes, node];
  const edges =
    action.sourceId && workflow.nodes.some((item) => item.id === action.sourceId)
      ? [
          ...workflow.edges,
          {
            id: newId("edge"),
            source: action.sourceId,
            target: node.id,
            sourceHandle: "out",
            targetHandle: "in",
            type: action.edgeType ?? "data",
            label: action.edgeLabel ?? "Agent connection"
          } satisfies WorkflowEdge
        ]
      : workflow.edges;

  return { workflow: { ...workflow, nodes, edges }, nodeId: node.id };
}

function addEdge(workflow: Workflow, action: Extract<AgentAction, { type: "add_edge" }>) {
  const source = action.sourceId ? workflow.nodes.find((node) => node.id === action.sourceId) : findNodeByLabel(workflow, action.sourceLabel);
  const target = action.targetId ? workflow.nodes.find((node) => node.id === action.targetId) : findNodeByLabel(workflow, action.targetLabel);
  if (!source || !target || source.id === target.id) return workflow;
  if (workflow.edges.some((edge) => edge.source === source.id && edge.target === target.id)) return workflow;
  return {
    ...workflow,
    edges: [
      ...workflow.edges,
      {
        id: newId("edge"),
        source: source.id,
        target: target.id,
        sourceHandle: "out",
        targetHandle: "in",
        type: action.edgeType ?? "data",
        label: action.label ?? "Agent connection"
      }
    ]
  };
}

function updateNode(workflow: Workflow, action: Extract<AgentAction, { type: "update_node" }>, selected?: { type: string; id: string }) {
  const targetId = action.nodeId ?? (action.useSelected && selected?.type === "node" ? selected.id : undefined);
  const target = targetId ? workflow.nodes.find((node) => node.id === targetId) : findNodeByLabel(workflow, action.nodeLabel);
  if (!target) return workflow;
  const patch = compactPatch({
    label: action.label,
    description: action.description,
    technology: action.technology,
    status: action.status,
    notes: action.notes
  });
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === target.id
        ? {
            ...node,
            data: {
              ...node.data,
              ...patch,
              configuration: { ...node.data.configuration, ...(action.configuration ?? {}) }
            }
          }
        : node
    )
  };
}

function nextNodePosition(workflow: Workflow) {
  const maxX = Math.max(80, ...workflow.nodes.map((node) => node.position.x));
  const countAtMax = workflow.nodes.filter((node) => node.position.x === maxX).length;
  return { x: maxX + 250, y: 150 + (countAtMax % 3) * 170 };
}

function findNodeByLabel(workflow: Workflow, label?: string) {
  if (!label) return null;
  const lower = label.toLowerCase();
  return workflow.nodes.find((node) => node.data.label.toLowerCase() === lower) ?? workflow.nodes.find((node) => node.data.label.toLowerCase().includes(lower));
}

function describeChanges(before: Workflow, after: Workflow) {
  const addedNodes = after.nodes.length - before.nodes.length;
  const addedEdges = after.edges.length - before.edges.length;
  const changedNodes = after.nodes.filter((node) => {
    const previous = before.nodes.find((item) => item.id === node.id);
    return previous && JSON.stringify(previous.data) !== JSON.stringify(node.data);
  }).length;

  return [
    addedNodes > 0 ? `added ${addedNodes} node${addedNodes === 1 ? "" : "s"}` : "",
    addedEdges > 0 ? `added ${addedEdges} edge${addedEdges === 1 ? "" : "s"}` : "",
    changedNodes > 0 ? `changed ${changedNodes} node${changedNodes === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
}

function buildNoActionMessage(prompt: string) {
  return `I can act on the canvas when you ask me to add nodes, connect edges, or change node content. Try: "Add an approval node and connect it after Human Review", or "Rename selected node to Risk Scoring".\n\nRequest heard: ${prompt}`;
}

function compactPatch<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as Partial<T>;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}
