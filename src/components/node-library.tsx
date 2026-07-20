"use client";

import { CATEGORY_COLORS, CATEGORY_LABELS, NODE_DEFINITIONS, getDefinitionsByCategory } from "@/domain/node-definitions";
import type { NodeCategory, NodeDefinition } from "@/domain/types";
import { useWorkflowStore } from "@/store/use-workflow-store";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DynamicIcon } from "./icon";

const categoryOrder = Object.keys(CATEGORY_LABELS) as NodeCategory[];

export function NodeLibrary() {
  const search = useWorkflowStore((state) => state.search);
  const setSearch = useWorkflowStore((state) => state.setSearch);
  const addNode = useWorkflowStore((state) => state.addNode);
  const libraryCollapsed = useWorkflowStore((state) => state.libraryCollapsed);
  const [collapsed, setCollapsed] = useState<Set<NodeCategory>>(new Set());
  const definitionsByCategory = useMemo(getDefinitionsByCategory, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return NODE_DEFINITIONS;
    return NODE_DEFINITIONS.filter((definition) =>
      [definition.name, definition.description, CATEGORY_LABELS[definition.category], ...(definition.keywords ?? [])].join(" ").toLowerCase().includes(query)
    );
  }, [search]);

  if (libraryCollapsed) {
    return <aside className="node-library compact" aria-label="Node library" />;
  }

  return (
    <aside className="node-library" aria-label="Node library">
      <header>
        <strong>Node Library</strong>
        <span>{NODE_DEFINITIONS.length} nodes</span>
      </header>
      <label className="search-box">
        <Search size={15} />
        <input id="node-library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" />
      </label>
      {!search && (
        <section className="library-section">
          <h2>Frequently Used</h2>
          <div className="library-list">
            {NODE_DEFINITIONS.filter((definition) => definition.frequentlyUsed).map((definition) => (
              <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
            ))}
          </div>
        </section>
      )}
      {search ? (
        <section className="library-section">
          <h2>Results</h2>
          <div className="library-list">
            {filtered.map((definition) => (
              <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
            ))}
          </div>
        </section>
      ) : (
        categoryOrder.map((category) => {
          const isCollapsed = collapsed.has(category);
          const definitions = definitionsByCategory[category] ?? [];
          return (
            <section className="library-section" key={category}>
              <button
                className="category-heading"
                type="button"
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })
                }
              >
                <span style={{ "--category-color": CATEGORY_COLORS[category] } as React.CSSProperties} />
                <h2>{CATEGORY_LABELS[category]}</h2>
                <ChevronDown size={14} className={isCollapsed ? "rotated" : ""} />
              </button>
              {!isCollapsed && (
                <div className="library-list">
                  {definitions.map((definition) => (
                    <LibraryItem key={definition.id} definition={definition} onAdd={() => addNode(definition.id)} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </aside>
  );
}

function LibraryItem({ definition, onAdd }: { definition: NodeDefinition; onAdd: () => void }) {
  return (
    <button
      className="library-item"
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/workflow-node", definition.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onAdd}
      style={{ "--category-color": CATEGORY_COLORS[definition.category] } as React.CSSProperties}
    >
      <span className="library-icon">
        <DynamicIcon name={definition.icon} />
      </span>
      <span>
        <strong>{definition.name}</strong>
        <small>
          {CATEGORY_LABELS[definition.category]} · {definition.description}
        </small>
      </span>
    </button>
  );
}
