import { agentExecutionModeSchema, agentPlanSchema, createAgentId, type AgentAction, type AgentContext, type AgentExecutionMode, type AgentPlan, type AgentRole, type WorkflowAccessRole } from "./types";
import { getAgentStrategy, routeAgents } from "./roles";

export interface PlanAgentRunInput {
  workflow: AgentContext["workflow"];
  prompt: string;
  messages?: AgentContext["messages"];
  selected?: AgentContext["selected"];
  executionMode?: AgentExecutionMode;
  userRole?: WorkflowAccessRole;
  userName?: string;
}

export function planAgentRun(input: PlanAgentRunInput): AgentPlan {
  const executionMode = agentExecutionModeSchema.parse(input.executionMode ?? "confirm_each_step");
  const context: AgentContext = {
    workflow: input.workflow,
    prompt: input.prompt,
    messages: input.messages,
    selected: input.selected,
    executionMode,
    userRole: input.userRole ?? "none",
    userName: input.userName
  };
  const routedRoles = routeAgents(context);
  const runnableRoles = routedRoles.filter((role) => role !== "router" && role !== "execution");
  const results = runnableRoles
    .map((role) => getAgentStrategy(role))
    .filter((strategy): strategy is NonNullable<typeof strategy> => Boolean(strategy))
    .filter((strategy) => strategy.canHandle(context))
    .map((strategy) => ({ role: strategy.role, result: strategy.plan(context) }));

  const actions = dedupeActions(results.flatMap(({ result }) => result.actions));
  const toolCalls = results.flatMap(({ result }) => result.toolCalls ?? []);
  const warnings = [...new Set(results.flatMap(({ result }) => result.warnings ?? []))];
  const selectedAgent = chooseSelectedAgent(routedRoles, actions);
  const message = buildPlanMessage(actions, warnings, executionMode);

  return agentPlanSchema.parse({
    id: createAgentId("agent-plan"),
    workflowId: input.workflow.id,
    prompt: input.prompt,
    executionMode,
    selectedAgent,
    agents: routedRoles,
    message,
    steps: [
      {
        id: createAgentId("step"),
        agentRole: "router",
        title: "Route request",
        summary: `Selected ${runnableRoles.length || 1} specialist agent(s).`,
        actionIds: [],
        toolCallIds: [],
        status: "completed"
      },
      ...results.map(({ role, result }) => ({
        id: createAgentId("step"),
        agentRole: role,
        title: getAgentStrategy(role)?.label ?? role,
        summary: result.summary,
        actionIds: result.actions.map((action) => action.id),
        toolCallIds: (result.toolCalls ?? []).map((toolCall) => toolCall.id),
        status: "planned" as const
      })),
      {
        id: createAgentId("step"),
        agentRole: "execution",
        title: "Wait for approval",
        summary: executionMode === "auto_apply" ? "Auto-apply is enabled after server-side role checks." : "Choose which proposed actions to apply.",
        actionIds: actions.map((action) => action.id),
        toolCallIds: [],
        status: "planned"
      }
    ],
    actions,
    toolCalls,
    warnings,
    createdAt: new Date().toISOString()
  });
}

function chooseSelectedAgent(roles: AgentRole[], actions: AgentAction[]): AgentRole {
  const firstActionRole = actions.find((action) => action.kind !== "recommendation.generate")?.agentRole;
  if (firstActionRole) return firstActionRole;
  return roles.find((role) => role !== "router" && role !== "execution") ?? "validation";
}

function buildPlanMessage(actions: AgentAction[], warnings: string[], executionMode: AgentExecutionMode) {
  if (!actions.length) return "I reviewed the workflow but did not find a concrete change to propose. Try naming the square, provider, edge, or document you want changed.";
  const mutableCount = actions.filter((action) => !["workflow.validate", "recommendation.generate", "llm.exportNodeContext"].includes(action.kind)).length;
  const readOnlyCount = actions.length - mutableCount;
  const modeText =
    executionMode === "auto_apply"
      ? "I can auto-apply the mutable actions after role checks."
      : executionMode === "plan_only"
        ? "This is a plan only; nothing will be changed until you switch mode or apply it."
        : "Review the proposed actions below, then apply the ones you want.";
  return [`Prepared ${actions.length} action(s): ${mutableCount} change(s) and ${readOnlyCount} read-only note(s).`, modeText, warnings.length ? `Warnings: ${warnings.slice(0, 3).join("; ")}` : ""]
    .filter(Boolean)
    .join(" ");
}

function dedupeActions(actions: AgentAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.kind}:${action.title}:${JSON.stringify(action.payload)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
