import { describe, expect, it } from "vitest";
import { executeAgentActions } from "@/agents/executor";
import { planAgentRun } from "@/agents/orchestrator";
import { createAgentAction } from "@/agents/types";
import { mcpResultToRecommendationAction, StaticMcpAdapter } from "@/agents/mcp/mcp-tool-adapter";
import { createApprovalChainSample } from "@/domain/samples";
import { createEmptyWorkflow, createNodeFromDefinitionId } from "@/domain/workflow-factory";

describe("agent orchestration", () => {
  it("plans provider changes as typed actions", () => {
    const workflow = createEmptyWorkflow("Provider test");
    const node = createNodeFromDefinitionId("data-lake", { x: 100, y: 100 });
    workflow.nodes = [node];

    const plan = planAgentRun({
      workflow,
      prompt: "Set selected provider to Azure",
      selected: { type: "node", id: node.id },
      userRole: "manager",
      userName: "Qiao Jiang"
    });

    expect(plan.agents).toContain("provider");
    expect(plan.actions.some((action) => action.kind === "node.update" && action.payload.configuration?.providerId === "azure")).toBe(true);
  });

  it("applies chained node additions using the previous generated node", () => {
    const workflow = createEmptyWorkflow("Chain test");
    const source = createNodeFromDefinitionId("database", { x: 0, y: 0 });
    workflow.nodes = [source];
    const actions = [
      createAgentAction({
        kind: "node.add",
        title: "Add validation",
        agentRole: "workflow_architect",
        target: { type: "node" },
        requiresRole: "manager",
        payload: { definitionId: "data-validation", sourceId: source.id }
      }),
      createAgentAction({
        kind: "node.add",
        title: "Add LLM",
        agentRole: "workflow_architect",
        target: { type: "node" },
        requiresRole: "manager",
        payload: { definitionId: "llm", sourceId: "__previous__" }
      })
    ];

    const result = executeAgentActions({ workflow, actions, userRole: "manager" });

    expect(result.workflow.nodes).toHaveLength(3);
    expect(result.workflow.edges).toHaveLength(2);
    expect(result.workflow.edges[1].source).toBe(result.workflow.nodes[1].id);
    expect(result.workflow.edges[1].target).toBe(result.workflow.nodes[2].id);
  });

  it("blocks creator-only approval edits for approver role but allows status decisions", () => {
    const workflow = createApprovalChainSample("underwriting");
    const node = workflow.nodes[0];
    const assign = createAgentAction({
      kind: "approval.assignApprover",
      title: "Assign approver",
      agentRole: "approval_chain",
      target: { type: "approval_square", id: node.id },
      requiresRole: "manager",
      payload: { nodeId: node.id, approver: "Chad Gordon" }
    });
    const approve = createAgentAction({
      kind: "approval.setStatus",
      title: "Approve square",
      agentRole: "approval_chain",
      target: { type: "approval_square", id: node.id },
      requiresRole: "approver",
      payload: { nodeId: node.id, status: "approved", actor: "Qiao Jiang" }
    });

    const result = executeAgentActions({ workflow, actions: [assign, approve], userRole: "approver", userName: "Qiao Jiang" });

    expect(result.actions.find((action) => action.id === assign.id)?.status).toBe("failed");
    expect(result.actions.find((action) => action.id === approve.id)?.status).toBe("applied");
    expect(result.workflow.nodes[0].data.configuration.approvalStatus).toBe("approved");
  });

  it("keeps MCP as catalog/read-only unless converted into a typed recommendation", async () => {
    const adapter = new StaticMcpAdapter([{ serverId: "azure-sql", name: "inspect_schema", title: "Inspect schema", writeRisk: "read" }]);
    const tools = await adapter.listTools();
    const result = await adapter.runTool("azure-sql", "inspect_schema");
    const action = mcpResultToRecommendationAction(result);

    expect(tools[0].serverId).toBe("azure-sql");
    expect(result.status).toBe("blocked");
    expect(action.kind).toBe("recommendation.generate");
  });
});
