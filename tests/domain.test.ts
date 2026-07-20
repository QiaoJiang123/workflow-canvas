import { describe, expect, it } from "vitest";
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
});
