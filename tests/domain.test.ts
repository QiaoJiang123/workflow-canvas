import { describe, expect, it } from "vitest";
import { APPROVAL_SQUARE_PRESETS, buildApprovalSquareConfiguration, getApprovalSquareGroups, normalizeApprovalSquareData } from "@/domain/approval-node-presets";
import { NODE_DEFINITIONS, getNodeDefinition } from "@/domain/node-definitions";
import { workflowExportSchema, workflowSchema } from "@/domain/schema";
import { createInsuranceClaimSeveritySample } from "@/domain/samples";
import { validateWorkflow } from "@/domain/validation";
import { createEmptyWorkflow, createNodeFromDefinitionId } from "@/domain/workflow-factory";

describe("workflow domain", () => {
  it("keeps the sample workflow schema-valid and meaningful", () => {
    const workflow = createInsuranceClaimSeveritySample();

    expect(() => workflowSchema.parse(workflow)).not.toThrow();
    expect(workflow.schemaVersion).toBe("1.0");
    expect(workflow.nodes.length).toBeGreaterThanOrEqual(10);
    expect(workflow.edges.length).toBeGreaterThanOrEqual(10);
    expect(workflow.groups.length).toBeGreaterThanOrEqual(6);
  });

  it("exports through the versioned envelope", () => {
    const workflow = createInsuranceClaimSeveritySample();
    const envelope = workflowExportSchema.parse({ schemaVersion: "1.0", workflow });

    expect(envelope.schemaVersion).toBe("1.0");
    expect(envelope.workflow.name).toContain("claim severity");
  });

  it("ships a broad AI and ML node registry", () => {
    expect(NODE_DEFINITIONS.length).toBeGreaterThanOrEqual(50);
    expect(getNodeDefinition("llm")?.fields.some((field) => field.key === "provider")).toBe(true);
    expect(getNodeDefinition("model-training")?.fields.some((field) => field.key === "modelType")).toBe(true);
    expect(getNodeDefinition("event-stream")?.keywords).toContain("Kafka");
    expect(getNodeDefinition("risk")?.category).toBe("documentation");
  });

  it("reports disconnected nodes and missing required fields", () => {
    const workflow = createEmptyWorkflow("Validation test");
    const training = createNodeFromDefinitionId("model-training", { x: 0, y: 0 });
    training.data.configuration.modelType = "";
    workflow.nodes = [training];

    const issues = validateWorkflow(workflow);

    expect(issues.some((issue) => issue.title === "Disconnected node")).toBe(true);
    expect(issues.some((issue) => issue.title === "Missing Model type")).toBe(true);
    expect(issues.some((issue) => issue.title === "Missing training input")).toBe(true);
    expect(issues.every((issue) => issue.code)).toBe(true);
    expect(issues.some((issue) => issue.suggestion)).toBe(true);
  });

  it("detects duplicate edges and cycles", () => {
    const workflow = createEmptyWorkflow("Cycle test");
    const a = createNodeFromDefinitionId("database", { x: 0, y: 0 });
    const b = createNodeFromDefinitionId("transformation", { x: 200, y: 0 });
    workflow.nodes = [a, b];
    workflow.edges = [
      { id: "edge-a", source: a.id, target: b.id, type: "data" },
      { id: "edge-b", source: a.id, target: b.id, type: "data" },
      { id: "edge-c", source: b.id, target: a.id, type: "feedback" }
    ];

    const issues = validateWorkflow(workflow);

    expect(issues.some((issue) => issue.title === "Duplicate edge")).toBe(true);
    expect(issues.some((issue) => issue.title === "Circular dependency")).toBe(true);
  });

  it("groups approval-chain square presets by process phase", () => {
    const groups = getApprovalSquareGroups();

    expect(APPROVAL_SQUARE_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(groups.Intake.some((preset) => preset.label === "Request Intake")).toBe(true);
    expect(groups.Review.some((preset) => preset.label === "Security Review")).toBe(true);
    expect(groups.Approval.some((preset) => preset.label === "Executive Approval")).toBe(true);
    expect(groups.Audit.some((preset) => preset.label === "Audit Record")).toBe(true);
  });

  it("normalizes approval square data for inspector, queue, and exports", () => {
    const configuration = buildApprovalSquareConfiguration({
      label: "Risk Committee Approval",
      description: "Committee signs off on residual risk.",
      creator: "Qiao Jiang",
      approver: "Chad Gordon",
      status: "in_review",
      dueDate: "2026-08-15",
      decision: "pending",
      comments: "Waiting for evidence packet."
    });

    const normalized = normalizeApprovalSquareData(configuration, { label: "Fallback" });

    expect(normalized.creator).toBe("Qiao Jiang");
    expect(normalized.approver).toBe("Chad Gordon");
    expect(normalized.approvalType).toBe("Risk Committee Approval");
    expect(normalized.status).toBe("in_review");
    expect(normalized.dueDate).toBe("2026-08-15");
    expect(normalized.auditTrail[0].action).toBe("created");
  });
});
