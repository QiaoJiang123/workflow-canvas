import { Loader2, Workflow } from "lucide-react";

export function LoadingFlow({ title = "Loading Flow...", detail = "Preparing the canvas and saved workflow data." }: { title?: string; detail?: string }) {
  return (
    <main className="flow-loading" aria-live="polite" aria-busy="true">
      <section className="flow-loading-card">
        <span className="flow-loading-mark" aria-hidden="true">
          <Workflow size={20} />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        <Loader2 className="flow-loading-spinner" size={18} aria-hidden="true" />
      </section>
    </main>
  );
}

