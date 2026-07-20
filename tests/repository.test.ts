import { beforeEach, describe, expect, it } from "vitest";
import { BrowserWorkflowRepository } from "@/lib/workflow-repository";
import { createEmptyWorkflow } from "@/domain/workflow-factory";

describe("browser workflow repository", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, lists, and loads workflows", async () => {
    const repository = new BrowserWorkflowRepository();
    const workflow = createEmptyWorkflow("Stored workflow");

    await repository.save(workflow);

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: workflow.id, name: "Stored workflow", nodeCount: 0 })
    ]);
    await expect(repository.get(workflow.id)).resolves.toEqual(expect.objectContaining({ id: workflow.id }));
  });

  it("recovers from invalid stored data", async () => {
    const repository = new BrowserWorkflowRepository();
    localStorage.setItem("workflow-canvas:index", JSON.stringify(["bad"]));
    localStorage.setItem("workflow-canvas:workflow:bad", "{bad json");

    await expect(repository.list()).resolves.toEqual([]);
    await expect(repository.get("bad")).resolves.toBeNull();
  });
});
