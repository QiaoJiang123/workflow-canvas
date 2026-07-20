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
});
