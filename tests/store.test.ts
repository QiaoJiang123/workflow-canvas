import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { useWorkflowStore } from "@/store/use-workflow-store";

describe("workflow store", () => {
  beforeEach(() => {
    useWorkflowStore.getState().clear();
  });

  it("adds nodes and supports undo/redo", () => {
    const initialCount = useWorkflowStore.getState().workflow.nodes.length;

    act(() => useWorkflowStore.getState().addNode("llm", { x: 100, y: 100 }));
    expect(useWorkflowStore.getState().workflow.nodes.length).toBe(initialCount + 1);

    act(() => useWorkflowStore.getState().undo());
    expect(useWorkflowStore.getState().workflow.nodes.length).toBe(initialCount);

    act(() => useWorkflowStore.getState().redo());
    expect(useWorkflowStore.getState().workflow.nodes.length).toBe(initialCount + 1);
  });

  it("duplicates the selected node with a unique id", () => {
    act(() => useWorkflowStore.getState().addNode("database", { x: 0, y: 0 }));
    const node = useWorkflowStore.getState().workflow.nodes.at(-1);
    expect(node).toBeDefined();

    act(() => {
      useWorkflowStore.getState().select({ type: "node", id: node!.id });
      useWorkflowStore.getState().duplicateSelected();
    });

    const nodes = useWorkflowStore.getState().workflow.nodes;
    expect(nodes).toHaveLength(2);
    expect(new Set(nodes.map((item) => item.id)).size).toBe(2);
  });

  it("stores one uploaded document and links it to multiple squares", () => {
    act(() => {
      useWorkflowStore.getState().addNode("database", { x: 0, y: 0 });
      useWorkflowStore.getState().addNode("llm", { x: 200, y: 0 });
    });
    const nodeIds = useWorkflowStore.getState().workflow.nodes.map((node) => node.id);
    const document = {
      id: "doc-risk-sop",
      title: "Risk SOP",
      type: "pdf" as const,
      url: "data:application/pdf;base64,JVBERi0x",
      summary: "Review instructions"
    };

    act(() => useWorkflowStore.getState().linkDocumentToNodes(document, nodeIds));

    const workflow = useWorkflowStore.getState().workflow;
    expect(workflow.reviewDocuments).toEqual([document]);
    expect(workflow.nodes.every((node) => Array.isArray(node.data.configuration.documents))).toBe(true);
    expect(workflow.nodes.every((node) => (node.data.configuration.documents as typeof workflow.reviewDocuments)?.[0]?.id === document.id)).toBe(true);
  });
});
