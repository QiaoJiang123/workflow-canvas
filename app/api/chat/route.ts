import type { Workflow } from "@/domain/types";
import { planWorkflowActions } from "@/domain/workflow-agent";
import { NextResponse } from "next/server";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequest {
  messages?: ChatMessage[];
  workflow?: Workflow;
  selected?: { type: string; id: string };
  context?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const messages = sanitizeMessages(body.messages ?? []);
  const latest = messages.at(-1);

  if (!latest?.content) {
    return NextResponse.json({ error: "Send a message to start the chat." }, { status: 400 });
  }

  const workflowContext = body.context?.slice(0, 4000) || summarizeWorkflow(body.workflow, body.selected);
  const agentPlan = planWorkflowActions(latest.content, body.workflow, body.selected);
  const fallback = agentPlan.actions.length ? agentPlan.message : buildLocalFallback(latest.content, workflowContext);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      mode: "local",
      message: `${fallback}\n\nSet OPENAI_API_KEY on the server to enable GPT-powered responses.`,
      actions: agentPlan.actions,
      workflow: agentPlan.workflow
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5",
        instructions:
          "You are Workflow Canvas Copilot. Help insurance and AI platform teams improve visual workflows. Be concise, practical, and reference the current workflow context when useful. If workflow actions were already applied, explain the result.",
        input: buildPrompt(messages, workflowContext),
        max_output_tokens: 700
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ mode: "local", message: fallback, actions: agentPlan.actions, workflow: agentPlan.workflow, error: detail.slice(0, 500) }, { status: 200 });
    }

    const data = (await response.json()) as { output_text?: string };
    return NextResponse.json({
      mode: "gpt",
      message: agentPlan.actions.length ? `${agentPlan.message}\n\n${data.output_text?.trim() || ""}`.trim() : data.output_text?.trim() || fallback,
      actions: agentPlan.actions,
      workflow: agentPlan.workflow
    });
  } catch (error) {
    return NextResponse.json({
      mode: "local",
      message: fallback,
      actions: agentPlan.actions,
      workflow: agentPlan.workflow,
      error: error instanceof Error ? error.message : "Chat request failed"
    });
  }
}

function sanitizeMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
    .slice(-8)
    .map((message) => ({ ...message, content: message.content.slice(0, 1600) }));
}

function buildPrompt(messages: ChatMessage[], workflowContext: string) {
  const transcript = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  return `Current workflow context:\n${workflowContext}\n\nConversation:\n${transcript}`;
}

function summarizeWorkflow(workflow?: Workflow, selected?: { type: string; id: string }) {
  if (!workflow) return "No workflow context was provided.";

  const selectedNode = selected?.type === "node" ? workflow.nodes.find((node) => node.id === selected.id) : null;
  const selectedEdge = selected?.type === "edge" ? workflow.edges.find((edge) => edge.id === selected.id) : null;
  const selectedGroup = selected?.type === "group" ? workflow.groups.find((group) => group.id === selected.id) : null;
  const nodes = workflow.nodes
    .slice(0, 24)
    .map((node) => `${node.data.label} (${node.data.category}, ${node.data.status ?? "not_started"})`)
    .join("; ");
  const edges = workflow.edges
    .slice(0, 24)
    .map((edge) => `${labelFor(workflow, edge.source)} -> ${labelFor(workflow, edge.target)}${edge.label ? `: ${edge.label}` : ""}`)
    .join("; ");

  return [
    `Workflow: ${workflow.name}`,
    `Description: ${workflow.description ?? "None"}`,
    `Counts: ${workflow.nodes.length} nodes, ${workflow.edges.length} edges, ${workflow.groups.length} stages`,
    `Selected: ${selectedNode?.data.label ?? selectedEdge?.label ?? selectedGroup?.title ?? selected?.type ?? "workflow"}`,
    `Nodes: ${nodes || "None"}`,
    `Edges: ${edges || "None"}`
  ].join("\n");
}

function labelFor(workflow: Workflow, id: string) {
  return workflow.nodes.find((node) => node.id === id)?.data.label ?? id;
}

function buildLocalFallback(question: string, workflowContext: string) {
  const lower = question.toLowerCase();
  if (lower.includes("risk") || lower.includes("issue")) {
    return "I can review the workflow for likely risks. Start with disconnected nodes, missing approvals before deployment, weak monitoring after inference, and unclear ownership on high-risk steps.";
  }
  if (lower.includes("summar")) {
    return `Here is the current workflow snapshot:\n${workflowContext}`;
  }
  if (lower.includes("improve") || lower.includes("recommend")) {
    return "Recommended improvements: keep source, transform, model, review, deployment, and monitoring stages explicit; add approval gates before production; document data sensitivity; and make feedback loops visible.";
  }
  return "I can help inspect the workflow, suggest missing nodes, explain selected nodes, and draft improvements. For GPT-powered answers, configure OPENAI_API_KEY on the server.";
}
