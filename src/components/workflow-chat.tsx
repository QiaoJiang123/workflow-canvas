"use client";

import { useWorkflowStore } from "@/store/use-workflow-store";
import type { Workflow } from "@/domain/types";
import { getAuthSession } from "@/lib/local-auth";
import { getWorkflowAccessRole } from "@/lib/workflow-access";
import { recordAgentExecution, recordAgentPlan } from "@/lib/local-flow-tables";
import type { AgentExecutionMode, AgentExecutionResult, AgentPlan } from "@/agents/types";
import { Bot, Check, ClipboardList, Loader2, Play, Send, Sparkles, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const starterPrompts = [
  "Add a review square after the selected square",
  "Set selected provider to Azure",
  "Validate gaps and recommend fixes"
];

export function WorkflowChat() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedItem = useWorkflowStore((state) => state.selectedItem);
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const sectionRef = useRef<HTMLElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask about the workflow, missing nodes, governance gaps, or how to improve the selected step."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [executionMode, setExecutionMode] = useState<AgentExecutionMode>("confirm_each_step");
  const [pendingPlan, setPendingPlan] = useState<AgentPlan | null>(null);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [session, setSession] = useState<ReturnType<typeof getAuthSession>>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userRole = useMemo(() => getWorkflowAccessRole(workflow, session?.user), [session?.user, workflow]);

  const contextLabel = useMemo(() => {
    if (selectedItem.type === "node") {
      return workflow.nodes.find((node) => node.id === selectedItem.id)?.data.label ?? "Selected node";
    }
    if (selectedItem.type === "edge") {
      return workflow.edges.find((edge) => edge.id === selectedItem.id)?.label ?? "Selected edge";
    }
    if (selectedItem.type === "group") {
      return workflow.groups.find((group) => group.id === selectedItem.id)?.title ?? "Selected stage";
    }
    return workflow.name;
  }, [selectedItem, workflow]);
  const workflowContext = useMemo(() => {
    const selectedNode = selectedItem.type === "node" ? workflow.nodes.find((node) => node.id === selectedItem.id) : null;
    const selectedEdge = selectedItem.type === "edge" ? workflow.edges.find((edge) => edge.id === selectedItem.id) : null;
    const selectedGroup = selectedItem.type === "group" ? workflow.groups.find((group) => group.id === selectedItem.id) : null;
    const nodes = workflow.nodes.map((node) => `${node.data.label} (${node.data.category}, ${node.data.status ?? "not_started"})`).join("; ");
    const edges = workflow.edges
      .map((edge) => `${labelFor(edge.source)} -> ${labelFor(edge.target)}${edge.label ? `: ${edge.label}` : ""}`)
      .join("; ");

    return [
      `Workflow: ${workflow.name}`,
      `Description: ${workflow.description ?? "None"}`,
      `Counts: ${workflow.nodes.length} nodes, ${workflow.edges.length} edges, ${workflow.groups.length} stages`,
      `Selected: ${selectedNode?.data.label ?? selectedEdge?.label ?? selectedGroup?.title ?? selectedItem.type}`,
      `Nodes: ${nodes || "None"}`,
      `Edges: ${edges || "None"}`
    ].join("\n");

    function labelFor(id: string) {
      return workflow.nodes.find((node) => node.id === id)?.data.label ?? id;
    }
  }, [selectedItem, workflow]);

  async function sendAgentPlan(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setPendingPlan(null);

    try {
      const response = await fetch("/api/agents/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          prompt: trimmed,
          workflow,
          selected: selectedItem,
          executionMode,
          userRole,
          userName: session?.user.name
        })
      });
      const data = (await response.json()) as { message?: string; error?: string; plan?: AgentPlan };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "The agent planner could not create a plan.");
      const plan = data.plan;

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message ?? plan.message
        }
      ]);
      setPendingPlan(plan);
      recordAgentPlan(plan, session?.user.name);
      const defaultActionIds = plan.actions.map((action) => action.id);
      setSelectedActionIds(defaultActionIds);
      if (executionMode === "auto_apply" && defaultActionIds.length) {
        await executePlan(plan, defaultActionIds, true);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "The agent request failed."
        }
      ]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  async function executePlan(plan: AgentPlan, approvedActionIds: string[], fromAutoApply = false) {
    if (!approvedActionIds.length || isSending) return;
    setIsSending(true);
    try {
      const response = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow,
          actions: plan.actions,
          approvedActionIds,
          selected: selectedItem,
          userRole,
          userName: session?.user.name,
          prompt: plan.prompt
        })
      });
      const data = (await response.json()) as Partial<AgentExecutionResult> & { error?: string };
      if (!response.ok || !data.workflow) throw new Error(data.error ?? "The agent executor could not apply this plan.");
      setWorkflow(data.workflow, false);
      if (data.actions && data.auditLog && data.warnings) {
        recordAgentExecution(plan.id, data as AgentExecutionResult);
      }
      setPendingPlan(null);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${fromAutoApply ? "Auto-applied" : "Applied"} ${data.actions?.filter((action) => action.status === "applied").length ?? approvedActionIds.length} action(s).${data.warnings?.length ? ` ${data.warnings.join(" ")}` : ""}`
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "The agent execution failed."
        }
      ]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendAgentPlan(input);
  }

  function toggleAction(actionId: string) {
    setSelectedActionIds((current) => (current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]));
  }

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    const chatRoot = root;

    function onSuggestionClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      const button = target?.closest<HTMLButtonElement>(".chat-suggestions button[data-agent-prompt]");
      if (!button || !chatRoot.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      void sendAgentPlan(button.dataset.agentPrompt ?? button.textContent ?? "");
    }

    chatRoot.addEventListener("click", onSuggestionClick, true);
    return () => chatRoot.removeEventListener("click", onSuggestionClick, true);
  });

  useEffect(() => {
    setSession(getAuthSession());
  }, []);

  return (
    <section
      ref={sectionRef}
      className="workflow-chat"
      aria-label="Workflow chatbot"
      data-workflow-context={workflowContext}
      data-workflow-json={JSON.stringify(workflow)}
      data-selected-json={JSON.stringify(selectedItem)}
    >
      <header className="chat-context">
        <span className="chat-avatar" aria-hidden="true">
          <Sparkles size={15} />
        </span>
        <div>
          <strong>Workflow Copilot</strong>
          <small title={contextLabel}>{contextLabel} · {userRole}</small>
        </div>
      </header>

      <div className="agent-mode-control" aria-label="Agent execution mode">
        <ClipboardList size={13} />
        <select value={executionMode} onChange={(event) => setExecutionMode(event.target.value as AgentExecutionMode)} disabled={isSending}>
          <option value="confirm_each_step">Confirm actions</option>
          <option value="plan_only">Plan only</option>
          <option value="auto_apply">Auto apply</option>
        </select>
      </div>

      <div className="chat-suggestions" aria-label="Suggested prompts">
        {starterPrompts.map((prompt) => (
          <button key={prompt} type="button" data-agent-prompt={prompt} onClick={() => void sendAgentPlan(prompt)} disabled={isSending}>
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.role}`}>
            <span className="chat-role" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}
            </span>
            <p data-role={message.role}>{message.content}</p>
          </article>
        ))}
        {isSending && (
          <article className="chat-message assistant">
            <span className="chat-role" aria-hidden="true">
              <Loader2 size={14} />
            </span>
            <p data-role="assistant">Thinking...</p>
          </article>
        )}
      </div>

      {pendingPlan && (
        <section className="agent-plan-card" aria-label="Pending agent plan">
          <header>
            <div>
              <strong>{pendingPlan.selectedAgent.replaceAll("_", " ")}</strong>
              <small>{pendingPlan.actions.length} proposed action(s)</small>
            </div>
            <button type="button" aria-label="Reject plan" title="Reject plan" onClick={() => setPendingPlan(null)} disabled={isSending}>
              <X size={14} />
            </button>
          </header>
          <div className="agent-step-list">
            {pendingPlan.steps.map((step) => (
              <span key={step.id}>{step.title}</span>
            ))}
          </div>
          <div className="agent-action-list">
            {pendingPlan.actions.map((actionItem) => (
              <label key={actionItem.id} className="agent-action-row">
                <input type="checkbox" checked={selectedActionIds.includes(actionItem.id)} onChange={() => toggleAction(actionItem.id)} disabled={isSending || executionMode === "plan_only"} />
                <span>
                  <strong>{actionItem.title}</strong>
                  <small>{actionItem.kind} · {actionItem.requiresRole ?? "read-only"}</small>
                </span>
              </label>
            ))}
          </div>
          <footer className="agent-plan-actions">
            <button type="button" onClick={() => void executePlan(pendingPlan, selectedActionIds)} disabled={isSending || executionMode === "plan_only" || !selectedActionIds.length}>
              <Check size={13} />
              <span>Apply selected</span>
            </button>
            <button type="button" onClick={() => void executePlan(pendingPlan, pendingPlan.actions.map((actionItem) => actionItem.id))} disabled={isSending || executionMode === "plan_only"}>
              <Play size={13} />
              <span>Apply all</span>
            </button>
          </footer>
        </section>
      )}

      <form className="chat-composer" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendAgentPlan(input);
            }
          }}
          placeholder="Ask an agent to add nodes, connect edges, or edit content"
          rows={3}
        />
        <button type="submit" aria-label="Send chat message" title="Send" disabled={!input.trim() || isSending}>
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
