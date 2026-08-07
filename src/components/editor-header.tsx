"use client";

import { useWorkflowStore } from "@/store/use-workflow-store";
import { workflowExportSchema } from "@/domain/schema";
import { createFullWorkflowImage, createWorkflowPdf } from "@/lib/pdf-export";
import { AuthStatus } from "./auth-status";
import { toPng } from "html-to-image";
import {
  BookOpenText,
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
  MoreVertical,
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
import { ChangeEvent, useEffect, useRef, useState, type ReactNode } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function runMenuAction(action: () => void) {
    action();
    setMenuOpen(false);
  }

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
    try {
      const workflowImage = await createFullWorkflowImage(workflow);
      const pdf = createWorkflowPdf({
        title: workflow.name,
        subtitle: `${workflow.nodes.length} ${workflow.flowKind === "approval_chain" ? "squares" : "nodes"} · ${workflow.edges.length} ${workflow.flowKind === "approval_chain" ? "arrows" : "edges"} · full workflow export · ${workflow.status.replaceAll("_", " ")}`,
        ...workflowImage
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
      <button className="brand-mark" type="button" aria-label="Back to workflow main page" title="Back to workflow main page" onClick={() => window.location.assign("/workflows")}>
        <Workflow size={18} />
      </button>
      <div className="header-title">
        <strong>Flow Canvas</strong>
        <input value={workflow.name} aria-label="Flow name" onChange={(event) => updateWorkflowMeta({ name: event.target.value })} />
      </div>
      <span className={`save-pill ${saveStatus}`}>
        <Save size={14} />
        {saveStatus === "idle" ? "Unsaved" : saveStatus}
      </span>
      <AuthStatus compact />
      <div className="header-actions" role="toolbar" aria-label="Workflow actions">
        <IconButton label="Flow manager" onClick={() => window.location.assign("/workflows")} icon={<LayoutDashboard size={16} />} />
        <IconButton label="Add stage rectangle" onClick={addGroup} icon={<Layers3 size={16} />} />
        <IconButton label="Undo" onClick={undo} disabled={!past.length} icon={<RotateCcw size={16} />} />
        <IconButton label="Redo" onClick={redo} disabled={!future.length} icon={<RotateCw size={16} />} />
        <IconButton label="Export PDF" onClick={exportPdf} icon={<FileText size={16} />} />
        <div className="header-more" ref={menuRef}>
          <button
            className="icon-button"
            type="button"
            aria-label="More actions"
            title="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen ? (
            <div className="header-more-menu" role="menu" aria-label="More workflow actions">
              <MenuAction icon={<BookOpenText size={15} />} label="Docs" onClick={() => runMenuAction(() => window.location.assign("/docs"))} />
              <MenuAction icon={<PanelLeftClose size={15} />} label="Toggle left panel" onClick={() => runMenuAction(toggleLibrary)} />
              <MenuAction icon={<PanelRightClose size={15} />} label="Toggle right panel" onClick={() => runMenuAction(toggleInspector)} />
              <MenuAction icon={<Wand2 size={15} />} label="Auto-layout" onClick={() => runMenuAction(autoLayout)} />
              <MenuDivider />
              <MenuAction icon={<Plus size={15} />} label="New AI workflow" onClick={() => runMenuAction(clear)} />
              <MenuAction icon={<FolderKanban size={15} />} label="Open sample" onClick={() => runMenuAction(loadSample)} />
              <MenuAction icon={<CheckCircle2 size={15} />} label={`Validate (${issues.length})`} onClick={() => runMenuAction(validate)} />
              <MenuDivider />
              <MenuAction icon={<Copy size={15} />} label="Copy JSON" onClick={() => runMenuAction(() => exportJson(true))} />
              <MenuAction icon={<Download size={15} />} label="Export JSON" onClick={() => runMenuAction(() => exportJson(false))} />
              <MenuAction icon={<ImageDown size={15} />} label="Export image" onClick={() => runMenuAction(exportImage)} />
              <MenuAction icon={<Upload size={15} />} label="Import JSON" onClick={() => runMenuAction(() => fileInputRef.current?.click())} />
              <MenuDivider />
              <MenuAction icon={theme === "light" ? <Moon size={15} /> : <Sun size={15} />} label={theme === "light" ? "Dark theme" : "Light theme"} onClick={() => runMenuAction(toggleTheme)} />
              <MenuAction
                icon={<HelpCircle size={15} />}
                label="Shortcuts"
                onClick={() => runMenuAction(() => setNotice("Shortcuts: Cmd/Ctrl+S save, K search, F fit view, D duplicate, Esc clear"))}
              />
              <div className="header-more-note" aria-live="polite">
                <FileJson size={13} />
                <span>{notice || "Ready"}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <input ref={fileInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={handleImport} />
    </header>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function MenuAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="header-more-item" type="button" role="menuitem" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="header-more-divider" role="separator" />;
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
