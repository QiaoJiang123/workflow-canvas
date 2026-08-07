import { describe, expect, it } from "vitest";
import { createInsuranceClaimSeveritySample } from "@/domain/samples";
import { buildNodeLlmExport } from "@/lib/node-llm-export";

describe("node LLM export", () => {
  it("packages one square with workflow, edge, stage, and provider context", () => {
    const workflow = createInsuranceClaimSeveritySample();
    const node = workflow.nodes.find((item) => item.definitionId === "data-lake");
    expect(node).toBeDefined();
    node!.data.configuration.providerId = "azure";

    const payload = buildNodeLlmExport(workflow, node!.id, "2026-07-24T00:00:00.000Z");

    expect(payload).toEqual(
      expect.objectContaining({
        schemaVersion: "1.0",
        exportType: "workflow_node_llm_context",
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );
    expect(payload?.workflow.name).toBe(workflow.name);
    expect(payload?.node.label).toBe(node!.data.label);
    expect(payload?.node.category).toBe("Data Sources");
    expect(payload?.node.provider?.name).toBe("Azure");
    expect(payload?.node.definition?.requiredFields).toContain("System");
    expect(payload?.stage?.title).toBe("Sources");
    expect(payload?.connections.outgoing).toHaveLength(1);
    expect(payload?.connections.outgoing[0].target.label).toBe("Data Validation");
    expect(payload?.connectedNodes.downstream[0].label).toBe("Data Validation");
    expect(payload?.evaluationPrompt).toContain("Evaluate this workflow square");
  });

  it("returns null for a missing square", () => {
    const workflow = createInsuranceClaimSeveritySample();

    expect(buildNodeLlmExport(workflow, "missing-node")).toBeNull();
  });
});
