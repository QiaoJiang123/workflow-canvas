import { workflowSchema } from "@/domain/schema";
import type { Workflow, WorkflowRepository, WorkflowSummary } from "@/lib/workflow-repository-types";

const INDEX_KEY = "workflow-canvas:index";
const RECORD_PREFIX = "workflow-canvas:workflow:";

export class BrowserWorkflowRepository implements WorkflowRepository {
  async list(): Promise<WorkflowSummary[]> {
    const ids = readIndex();
    const workflows = ids
      .map((id) => readWorkflow(id))
      .filter((workflow): workflow is Workflow => Boolean(workflow));
    return workflows
      .map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        updatedAt: workflow.updatedAt,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Workflow | null> {
    return readWorkflow(id);
  }

  async save(workflow: Workflow): Promise<void> {
    workflowSchema.parse(workflow);
    localStorage.setItem(`${RECORD_PREFIX}${workflow.id}`, JSON.stringify(workflow));
    const ids = new Set(readIndex());
    ids.add(workflow.id);
    localStorage.setItem(INDEX_KEY, JSON.stringify([...ids]));
  }

  async delete(id: string): Promise<void> {
    localStorage.removeItem(`${RECORD_PREFIX}${id}`);
    localStorage.setItem(INDEX_KEY, JSON.stringify(readIndex().filter((item) => item !== id)));
  }
}

function readIndex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function readWorkflow(id: string): Workflow | null {
  try {
    const raw = localStorage.getItem(`${RECORD_PREFIX}${id}`);
    if (!raw) return null;
    return workflowSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
