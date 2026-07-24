"use client";

import { useWorkflowStore } from "@/store/use-workflow-store";
import { workflowExportSchema } from "@/domain/schema";
import { createWorkflowPdf } from "@/lib/pdf-export";
import { toJpeg, toPng } from "html-to-image";
import {
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderKanban,
  HelpCircle,
  ImageDown,
  Layers3,
  LayoutDashboard,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Sun,
  Upload,
  Wand2,
  Workflow
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";

export function EditorHeader({ onImport }: { onImport: (json: string) => void }) {
  const workflow = useWorkflowStore((state) => state.workflow);
  const saveStatus = useWorkflowStore((state) => state.saveStatus);
  const theme = useWorkflowStore((state) => state.theme);
  const issues = useWorkflowStore((state) => state.validationIssues);
  const past = useWorkflowStore((state) => state.past);
  const future = useWorkflowStore((state) => state.future);
  const updateWorkflowMeta = useWorkflowStore((state) => state.updateWorkflowMeta);
  const clear = useWorkflowStore((state) => state.clear);
  const loadSample = useWorkflowStore((state) => state.loadSample);
  const addGroup = useWorkflowStore((state) => state.addGroup);
  const autoLayout = useWorkflowStore((state) => state.autoLayout);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const validate = useWorkflowStore((state) => state.validate);
  const toggleTheme = useWorkflowStore((state) => state.toggleTheme);
  const toggleLibrary = useWorkflowStore((state) => state.toggleLibrary);
  const toggleInspector = useWorkflowStore((state) => state.toggleInspector);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportJson(copy = false) {
    const envelope = workflowExportSchema.parse({ schemaVersion: "1.0", workflow });
    const content = JSON.stringify(envelope, null, 2);
    if (copy) {
      navigator.clipboard?.writeText(content);
      setNotice("Copied JSON");
      return;
    }
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}-${workflow.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Exported JSON");
  }

  function exportImage() {
    const canvas = document.querySelector(".canvas-shell") as HTMLElement | null;
    if (!canvas) return;
    toPng(canvas, { backgroundColor: getComputedStyle(document.body).getPropertyValue("--canvas-bg") || "#f8fafc" }).then((url) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}.png`;
      anchor.click();
      setNotice("Exported image");
    });
  }

  async function exportPdf() {
    const canvas = document.querySelector(".canvas-shell") as HTMLElement | null;
    if (!canvas) return;
    try {
      const styles = getComputedStyle(document.body);
      const imageDataUrl = await toJpeg(canvas, {
        backgroundColor: styles.getPropertyValue("--canvas-bg") || "#f8fafc",
        quality: 0.92,
        pixelRatio: 1.5
      });
      const pdf = createWorkflowPdf({
        title: workflow.name,
        subtitle: `${workflow.nodes.length} nodes · ${workflow.edges.length} edges · ${workflow.status.replaceAll("_", " ")}`,
        imageDataUrl,
        imageWidth: canvas.clientWidth * 1.5,
        imageHeight: canvas.clientHeight * 1.5
      });
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugify(workflow.name) || "workflow"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Exported PDF");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PDF export failed");
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onImport(await file.text());
      setNotice("Imported workflow");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <header className="editor-header">
      <div className="brand-mark" aria-hidden="true">
        <Workflow size={18} />
      </div>
      <div className="header-title">
        <strong>Flow Canvas</strong>
        <input value={workflow.name} aria-label="Flow name" onChange={(event) => updateWorkflowMeta({ name: event.target.value })} />
      </div>
      <span className={`save-pill ${saveStatus}`}>
        <Save size={14} />
        {saveStatus === "idle" ? "Unsaved" : saveStatus}
      </span>
      <div className="header-actions" role="toolbar" aria-label="Workflow actions">
        <IconButton label="Flow manager" onClick={() => window.location.assign("/workflows")} icon={<LayoutDashboard size={16} />} />
        <IconButton label="Toggle library" onClick={toggleLibrary} icon={<PanelLeftClose size={16} />} />
        <IconButton label="New AI workflow" onClick={clear} icon={<Plus size={16} />} />
        <IconButton label="Add stage rectangle" onClick={addGroup} icon={<Layers3 size={16} />} />
        <IconButton label="Open AI workflow sample" onClick={loadSample} icon={<FolderKanban size={16} />} />
        <IconButton label="Undo" onClick={undo} disabled={!past.length} icon={<RotateCcw size={16} />} />
        <IconButton label="Redo" onClick={redo} disabled={!future.length} icon={<RotateCw size={16} />} />
        <IconButton label="Auto-layout" onClick={autoLayout} icon={<Wand2 size={16} />} />
        <IconButton label="Validate" onClick={validate} icon={<CheckCircle2 size={16} />} />
        <IconButton label="Copy JSON" onClick={() => exportJson(true)} icon={<Copy size={16} />} />
        <IconButton label="Export JSON" onClick={() => exportJson(false)} icon={<Download size={16} />} />
        <IconButton label="Export image" onClick={exportImage} icon={<ImageDown size={16} />} />
        <IconButton label="Export PDF" onClick={exportPdf} icon={<FileText size={16} />} />
        <IconButton label="Import JSON" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16} />} />
        <IconButton label="Toggle inspector" onClick={toggleInspector} icon={<PanelRightClose size={16} />} />
        <IconButton label="Toggle theme" onClick={toggleTheme} icon={theme === "light" ? <Moon size={16} /> : <Sun size={16} />} />
        <IconButton
          label="Help"
          onClick={() => setNotice("Shortcuts: Cmd/Ctrl+S save, K search, F fit view, D duplicate, Esc clear")}
          icon={<HelpCircle size={16} />}
        />
      </div>
      <div className="header-meta">
        <span title="Validation issues">
          <Braces size={14} />
          {issues.length}
        </span>
        <span>AI Platform</span>
      </div>
      <input ref={fileInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={handleImport} />
      <span className="header-notice" aria-live="polite">
        <FileJson size={14} />
        {notice || "Ready"}
      </span>
    </header>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function IconButton({
  label,
  icon,
  onClick,
  disabled = false
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {icon}
    </button>
  );
}
