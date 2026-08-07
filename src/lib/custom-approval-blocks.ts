"use client";

import type { ApprovalSquarePreset } from "@/domain/approval-node-presets";

const STORAGE_KEY = "workflow-canvas:custom-approval-blocks";

export type CustomApprovalBlock = ApprovalSquarePreset & {
  savedAt: string;
};

export function listCustomApprovalBlocks() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCustomApprovalBlock).sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

export function saveCustomApprovalBlock(input: Omit<ApprovalSquarePreset, "id"> & { id?: string }) {
  const block: CustomApprovalBlock = {
    ...input,
    id: input.id || newBlockId(input.label),
    savedAt: new Date().toISOString()
  };
  const next = [
    block,
    ...listCustomApprovalBlocks().filter((item) => item.id !== block.id && item.label.toLowerCase() !== block.label.toLowerCase())
  ];
  writeCustomApprovalBlocks(next);
  return block;
}

export function deleteCustomApprovalBlock(id: string) {
  if (typeof window === "undefined") return;
  writeCustomApprovalBlocks(listCustomApprovalBlocks().filter((block) => block.id !== id));
}

export function parseCustomApprovalBlock(value: string) {
  try {
    const parsed = JSON.parse(value);
    return isCustomApprovalBlock(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCustomApprovalBlocks(blocks: CustomApprovalBlock[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

function isCustomApprovalBlock(value: unknown): value is CustomApprovalBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<CustomApprovalBlock>;
  return (
    typeof block.id === "string" &&
    typeof block.label === "string" &&
    typeof block.description === "string" &&
    typeof block.definitionId === "string" &&
    typeof block.savedAt === "string" &&
    ["Intake", "Review", "Approval", "Exception", "Notification", "Audit"].includes(String(block.group)) &&
    Boolean(block.configuration) &&
    typeof block.configuration === "object"
  );
}

function newBlockId(label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-block";
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `custom-approval-block-${slug}-${suffix}`;
}
