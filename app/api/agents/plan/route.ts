import type { Workflow } from "@/domain/types";
import { planAgentRun } from "@/agents/orchestrator";
import { NextResponse } from "next/server";

interface AgentPlanRequest {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  prompt?: string;
  workflow?: Workflow;
  selected?: { type: string; id: string };
  executionMode?: "plan_only" | "confirm_each_step" | "auto_apply";
  userRole?: "manager" | "approver" | "reader" | "none";
  userName?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AgentPlanRequest;
  const prompt = body.prompt?.trim() || body.messages?.filter((message) => message.role === "user").at(-1)?.content?.trim();
  if (!prompt) return NextResponse.json({ error: "Send a prompt to start the agent plan." }, { status: 400 });
  if (!body.workflow) return NextResponse.json({ error: "Workflow context is required for agent planning." }, { status: 400 });

  const plan = planAgentRun({
    workflow: body.workflow,
    prompt,
    messages: body.messages?.slice(-8),
    selected: body.selected,
    executionMode: body.executionMode,
    userRole: body.userRole,
    userName: body.userName
  });
  return NextResponse.json({ plan, message: plan.message, actions: plan.actions });
}
