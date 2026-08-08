"use client";

import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { createApprovalChainSample, createInsuranceClaimSeveritySample } from "@/domain/samples";
import { workflowExportSchema, workflowSchema } from "@/domain/schema";
import type { Workflow } from "@/domain/types";
import { duplicateWorkflow } from "@/domain/workflow-factory";
import { EditorHeader } from "./editor-header";
import { Inspector } from "./inspector";
import { LoadingFlow } from "./loading-flow";
import { NodeLibrary } from "./node-library";
import { ValidationDrawer } from "./validation-drawer";
import { WorkflowCanvas } from "./workflow-canvas";
import { getAuthSession } from "@/lib/local-auth";
import { canUserAccessWorkflow } from "@/lib/workflow-access";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const repository = new BrowserWorkflowRepository();

export function WorkflowEditor({ workflowId }: { workflowId?: string }) {
  const router = useRouter();
  const workflow = useWorkflowStore((state) => state.workflow);
  const theme = useWorkflowStore((state) => state.theme);
  const libraryCollapsed = useWorkflowStore((state) => state.libraryCollapsed);
  const inspectorCollapsed = useWorkflowStore((state) => state.inspectorCollapsed);
  const inspectorExpanded = useWorkflowStore((state) => state.inspectorExpanded);
  const validationOpen = useWorkflowStore((state) => state.validationOpen);
  const validationIssues = useWorkflowStore((state) => state.validationIssues);
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const setSaveStatus = useWorkflowStore((state) => state.setSaveStatus);
  const duplicateSelected = useWorkflowStore((state) => state.duplicateSelected);
  const deleteSelected = useWorkflowStore((state) => state.deleteSelected);
  const copySelected = useWorkflowStore((state) => state.copySelected);
  const pasteClipboard = useWorkflowStore((state) => state.pasteClipboard);
  const clearSelection = useWorkflowStore((state) => state.clearSelection);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const toggleInspectorExpanded = useWorkflowStore((state) => state.toggleInspectorExpanded);
  const loadedWorkflowRef = useRef("");
  const [repositoryReady, setRepositoryReady] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const loadKey = workflowId ?? "first";
    if (loadedWorkflowRef.current === loadKey) return;
    loadedWorkflowRef.current = loadKey;
    setRepositoryReady(false);

    const loadWorkflow = async () => {
      const targetId = workflowId ?? (await repository.list())[0]?.id;
      const stored = targetId ? await repository.get(targetId) : null;
      if (!stored) {
        setSaveStatus("error");
        setRepositoryReady(true);
        return;
      }
      const session = getAuthSession();
      if (session && !canUserAccessWorkflow(stored, session.user)) {
        setSaveStatus("error");
        setRepositoryReady(true);
        router.replace("/workflows");
        return;
      }
      const refreshedSample = shouldRefreshApprovalSample(stored) ? createApprovalChainSample() : shouldRefreshStoredSample(stored) ? createInsuranceClaimSeveritySample() : stored;
      setWorkflow(refreshedSample, true);
      if (refreshedSample !== stored) await repository.save(refreshedSample);
      setSaveStatus("saved");
      setRepositoryReady(true);
    };
    void loadWorkflow();
  }, [router, setSaveStatus, setWorkflow, workflowId]);

  useEffect(() => {
    if (!repositoryReady) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        await repository.save(useWorkflowStore.getState().workflow);
        if (!cancelled) setSaveStatus("saved");
      } catch {
        if (!cancelled) setSaveStatus("error");
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [repositoryReady, setSaveStatus, workflow]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (isTyping) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveStatus("saving");
        repository
          .save(useWorkflowStore.getState().workflow)
          .then(() => setSaveStatus("saved"))
          .catch(() => setSaveStatus("error"));
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        clearSelection();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#node-library-search")?.focus();
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        const state = useWorkflowStore.getState();
        if (!canDeleteSelectedItem(state.workflow, state.selectedItem)) return;
        deleteSelected();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, copySelected, deleteSelected, duplicateSelected, pasteClipboard, redo, setSaveStatus, undo]);

  const gridClass = useMemo(
    () =>
      [
        "editor-shell",
        libraryCollapsed ? "library-collapsed" : "",
        inspectorCollapsed ? "inspector-collapsed" : "",
        inspectorExpanded ? "inspector-expanded" : "",
        validationOpen && validationIssues.length ? "validation-open" : ""
      ].join(" "),
    [inspectorCollapsed, inspectorExpanded, libraryCollapsed, validationIssues.length, validationOpen]
  );

  if (!repositoryReady) {
    return <LoadingFlow title="Loading Flow..." detail="Loading the workflow graph, nodes, edges, stages, and review documents." />;
  }

  return (
    <main className={gridClass}>
      <EditorHeader
        onImport={(json) => {
          const parsed = parseWorkflowImport(json);
          setWorkflow(duplicateWorkflow(parsed, parsed.name), false);
        }}
      />
      <NodeLibrary />
      <WorkflowCanvas />
      {!inspectorCollapsed ? (
        <button
          type="button"
          className="inspector-edge-toggle"
          aria-label={inspectorExpanded ? "Shrink right panel" : "Expand right panel"}
          title={inspectorExpanded ? "Shrink right panel" : "Expand right panel"}
          onClick={toggleInspectorExpanded}
        >
          <span aria-hidden="true">{inspectorExpanded ? <ChevronsRight /> : <ChevronsLeft />}</span>
        </button>
      ) : null}
      <Inspector />
      <ValidationDrawer />
    </main>
  );
}

function parseWorkflowImport(json: string): Workflow {
  const parsed = JSON.parse(json);
  const workflow = "schemaVersion" in parsed ? workflowExportSchema.parse(parsed).workflow : workflowSchema.parse(parsed);
  return workflow as Workflow;
}

function canDeleteSelectedItem(workflow: Workflow, selectedItem: { type: string; id: string }) {
  if (workflow.flowKind !== "approval_chain" || selectedItem.type !== "node") return true;
  const node = workflow.nodes.find((item) => item.id === selectedItem.id);
  if (!node) return true;
  const creator = String(node.data.configuration.creator ?? node.data.owner ?? workflow.owner ?? "").trim().toLowerCase();
  if (!creator) return true;
  const user = getAuthSession()?.user;
  const userValues = [user?.name, user?.email].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  return userValues.includes(creator);
}

function shouldRefreshStoredSample(workflow: { id?: string; name: string; flowKind?: string; nodes: Array<{ position: { x: number } }> }) {
  if (workflow.id !== "workflow-claim-severity-sample" && workflow.name !== "Insurance claim severity workflow") return false;
  if (workflow.flowKind !== "ai_workflow") return true;
  if (!workflow.nodes.length) return true;
  const maxX = Math.max(0, ...workflow.nodes.map((node) => node.position.x));
  return maxX > 1900 || workflow.nodes.length < 15;
}

function shouldRefreshApprovalSample(workflow: { id?: string; name: string; flowKind?: string; approvalChainType?: string; owner?: string; reviewDocuments?: unknown[]; nodes?: Array<{ data?: { configuration?: Record<string, unknown> } }> }) {
  if (workflow.id !== "flow-underwriting-approval-chain-sample" && workflow.name !== "Underwriting approval chain") return false;
  return (
    workflow.flowKind !== "approval_chain" ||
    workflow.approvalChainType !== "underwriting" ||
    workflow.owner !== "Qiao Jiang" ||
    Boolean(workflow.reviewDocuments?.length) ||
    !workflow.nodes?.every((node) => String(node.data?.configuration?.creator ?? "") === "Qiao Jiang") ||
    !workflow.nodes?.every((node) => Array.isArray(node.data?.configuration?.documents) && node.data.configuration.documents.length > 0) ||
    !workflow.nodes?.some((node) =>
      ["Qiao Jiang", "Chad Gordon", "Johann Sun", "Chae Won Lee"].includes(
        String(node.data?.configuration?.approver ?? node.data?.configuration?.assignee ?? node.data?.configuration?.reviewer ?? "")
      )
    )
  );
}
