import type { Workflow } from "@/domain/types";
import { executeAgentActions } from "@/agents/executor";
import type { AgentAction } from "@/agents/types";
import { NextResponse } from "next/server";

interface AgentExecuteRequest {
  workflow?: Workflow;
  actions?: AgentAction[];
  approvedActionIds?: string[];
  selected?: { type: string; id: string };
  userRole?: "manager" | "approver" | "reader" | "none";
  userName?: string;
  prompt?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AgentExecuteRequest;
  if (!body.workflow) return NextResponse.json({ error: "Workflow context is required for execution." }, { status: 400 });
  if (!body.actions?.length) return NextResponse.json({ error: "At least one proposed action is required." }, { status: 400 });

  const result = executeAgentActions({
    workflow: body.workflow,
    actions: body.actions,
    approvedActionIds: body.approvedActionIds,
    selected: body.selected,
    userRole: body.userRole ?? "none",
    userName: body.userName,
    prompt: body.prompt
  });

  return NextResponse.json(result);
}
