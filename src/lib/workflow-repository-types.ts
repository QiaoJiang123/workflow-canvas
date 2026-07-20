import type { Workflow, WorkflowSummary } from "@/domain/types";

export type { Workflow, WorkflowSummary };

export interface WorkflowRepository {
  list(): Promise<WorkflowSummary[]>;
  get(id: string): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  delete(id: string): Promise<void>;
}
