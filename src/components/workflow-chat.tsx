"use client";

import { useWorkflowStore } from "@/store/use-workflow-store";
import type { Workflow } from "@/domain/types";
import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const starterPrompts = [
  "Add approval and monitoring nodes with edges",
  "Connect Human Review to Model Registry",
  "Change selected node content"
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          workflow,
          selected: selectedItem
        })
      });
      const data = (await response.json()) as { message?: string; error?: string; workflow?: Workflow };
      if (data.workflow) setWorkflow(data.workflow, false);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message ?? data.error ?? "I could not generate a response."
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "The chat request failed."
        }
      ]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
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
      void sendMessage(button.dataset.agentPrompt ?? button.textContent ?? "");
    }

    chatRoot.addEventListener("click", onSuggestionClick, true);
    return () => chatRoot.removeEventListener("click", onSuggestionClick, true);
  });

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
          <small title={contextLabel}>{contextLabel}</small>
        </div>
      </header>

      <div className="chat-suggestions" aria-label="Suggested prompts">
        {starterPrompts.map((prompt) => (
          <button key={prompt} type="button" data-agent-prompt={prompt} onClick={() => void sendMessage(prompt)} disabled={isSending}>
            {prompt}
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

      <form className="chat-composer" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(input);
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
