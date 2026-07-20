import { getNodeDefinition } from "./node-definitions";
import type { ValidationIssue, Workflow } from "./types";

export function validateWorkflow(workflow: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const edgeKeys = new Set<string>();

  if (!workflow.name.trim()) {
    issues.push(
      issue("warning", "workflow", workflow.id, "missing_workflow_name", "Missing workflow name", "The workflow needs a stable name for sharing and review.", {
        suggestion: "Add a concise project or system name in the workflow inspector."
      })
    );
  }

  for (const node of workflow.nodes) {
    if (!node.data.label.trim()) {
      issues.push(
        issue("error", "node", node.id, "missing_node_name", "Missing node label", "Every node needs a readable name.", {
          field: "label",
          suggestion: "Name the component after the system, operation, or decision it represents."
        })
      );
    }

    const definition = getNodeDefinition(node.definitionId);
    for (const field of definition?.fields ?? []) {
      const value =
        field.key in node.data
          ? node.data[field.key as keyof typeof node.data]
          : node.data.configuration[field.key];
      if (field.required && !String(value ?? "").trim()) {
        issues.push(
          issue("warning", "node", node.id, "missing_required_configuration", `Missing ${field.label}`, `${definition?.name ?? "This node"} needs ${field.label}.`, {
            field: field.key,
            suggestion: `Fill in ${field.label} in the node inspector.`
          })
        );
      }
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(
        issue("error", "edge", edge.id, "edge_references_missing_node", "Invalid edge", "This connection points to a node that no longer exists.", {
          suggestion: "Delete the broken edge or reconnect it to valid nodes."
        })
      );
      continue;
    }
    if (edge.source === edge.target) {
      issues.push(
        issue("error", "edge", edge.id, "invalid_handle_connection", "Self connection", "A node cannot connect to itself.", {
          suggestion: "Connect this edge to a separate upstream or downstream node."
        })
      );
    }
    const key = `${edge.source}:${edge.target}:${edge.type}`;
    if (edgeKeys.has(key)) {
      issues.push(
        issue("warning", "edge", edge.id, "duplicate_edge", "Duplicate edge", "These two nodes already have this kind of connection.", {
          suggestion: "Keep one edge and use the edge label or type to clarify the relationship."
        })
      );
    }
    edgeKeys.add(key);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  for (const node of workflow.nodes) {
    const definition = getNodeDefinition(node.definitionId);
    if ((incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) === 0 && node.data.category !== "documentation") {
      issues.push(
        issue("info", "node", node.id, "disconnected_node", "Disconnected node", "This node is not connected to the workflow yet.", {
          suggestion: "Connect it to an upstream source, downstream consumer, or move it into documentation if it is only a note."
        })
      );
    }
    if (definition?.category === "machine_learning" && node.definitionId === "model-training" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push(
        issue("error", "node", node.id, "model_training_without_data_input", "Missing training input", "Model training needs an upstream dataset or feature source.", {
          suggestion: "Connect feature engineering, a train/test split, or another prepared dataset to this node."
        })
      );
    }
    if (node.definitionId === "model-training" && (outgoing.get(node.id) ?? 0) === 0) {
      issues.push(
        issue("warning", "node", node.id, "missing_model_output", "Missing model output", "Model training should feed evaluation, registry, or inference.", {
          suggestion: "Connect this training node to an evaluation or registry step."
        })
      );
    }
    if (node.definitionId.includes("evaluation") && !hasUpstreamCategory(workflow, node.id, "machine_learning")) {
      issues.push(
        issue("warning", "node", node.id, "model_evaluation_without_model_input", "Evaluation without model input", "Model evaluation should be downstream of model training or a registered model.", {
          suggestion: "Connect the evaluation to a model training, registry, or serving node."
        })
      );
    }
    if (node.data.category === "deployment" && !hasUpstreamCategory(workflow, node.id, "machine_learning")) {
      issues.push(
        issue("warning", "node", node.id, "deployment_without_trained_model", "Deployment without model", "Deployment nodes should be downstream of model training or registry.", {
          suggestion: "Connect a model training or model registry node before deployment."
        })
      );
    }
    if (node.data.category === "monitoring" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push(
        issue("warning", "node", node.id, "monitoring_without_monitored_component", "Monitoring without component", "Monitoring should be connected to the component it observes.", {
          suggestion: "Connect the deployed model, batch inference, or business output being monitored."
        })
      );
    }
    if (node.data.category === "human_review" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push(
        issue("warning", "node", node.id, "human_approval_without_incoming_decision", "Review without incoming decision", "Human review should receive a case, exception, or decision to inspect.", {
          suggestion: "Connect a scoring, guardrail, escalation, or decision node into this review step."
        })
      );
    }
    if (node.data.category === "outputs" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push(
        issue("warning", "node", node.id, "output_without_upstream_source", "Output without upstream source", "Output nodes should be downstream of data, model, or application logic.", {
          suggestion: "Connect the workflow result that this output presents or stores."
        })
      );
    }
  }

  if (hasCycle(workflow)) {
    issues.push(
      issue("error", "workflow", workflow.id, "circular_dependency", "Circular dependency", "The workflow contains a directed cycle.", {
        suggestion: "Remove the feedback edge or change it to documentation if it is only conceptual."
      })
    );
  }

  return issues;
}

function issue(
  severity: ValidationIssue["severity"],
  targetType: ValidationIssue["targetType"],
  targetId: string | undefined,
  code: string,
  title: string,
  message: string,
  options: Pick<ValidationIssue, "field" | "suggestion"> = {}
): ValidationIssue {
  return {
    id: `${targetType}-${targetId ?? "workflow"}-${code}`,
    severity,
    code,
    targetType,
    targetId,
    nodeId: targetType === "node" ? targetId : undefined,
    edgeId: targetType === "edge" ? targetId : undefined,
    ...options,
    title,
    message
  };
}

function hasUpstreamCategory(workflow: Workflow, nodeId: string, category: string) {
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visited.has(id)) return false;
    visited.add(id);
    const parents = workflow.edges.filter((edge) => edge.target === id).map((edge) => edge.source);
    return parents.some((parentId) => byId.get(parentId)?.data.category === category || visit(parentId));
  }

  return visit(nodeId);
}

function hasCycle(workflow: Workflow) {
  const graph = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    graph.set(node.id, []);
  }
  for (const edge of workflow.edges) {
    graph.get(edge.source)?.push(edge.target);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of graph.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return [...graph.keys()].some(visit);
}
