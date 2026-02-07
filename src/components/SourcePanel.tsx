"use client";

import { useState } from "react";
import { Source } from "@/types/trip";

interface SourcePanelProps {
  sources: Source[];
  excludedCategories: string[];
  onAddSource: (name: string, category: string, memo: string) => void;
  onRemoveSource: (id: string) => void;
  onForgetCategory: (category: string) => void;
  onRestoreCategory: (category: string) => void;
  onImportJson: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  cafe: "☕",
  museum: "🏛️",
  market: "🛒",
  viewpoint: "🔭",
  park: "🌿",
  bookstore: "📚",
  neighborhood_walk: "🚶",
  food: "🍽️",
  shop: "🛍️",
  sightseeing: "🏛️",
  culture: "🎭",
  nature: "🌿",
  shopping: "🛍️",
  other: "📌",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] || "📌";
}

export default function SourcePanel({
  sources,
  excludedCategories,
  onAddSource,
  onRemoveSource,
  onForgetCategory,
  onRestoreCategory,
  onImportJson,
}: SourcePanelProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("sightseeing");
  const [memo, setMemo] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setIsAdding(true);
    await onAddSource(name.trim(), category, memo.trim());
    setName("");
    setMemo("");
    setIsAdding(false);
  };

  // Group sources by category
  const grouped: Record<string, Source[]> = {};
  sources.forEach((s) => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  const activeCategories = Object.keys(grouped).filter(
    (cat) => !excludedCategories.includes(cat)
  );
  const excludedWithSources = Object.keys(grouped).filter(
    (cat) => excludedCategories.includes(cat)
  );
  const excludedWithoutSources = excludedCategories.filter(
    (cat) => !grouped[cat]
  );

  return (
    <div className="flex flex-col h-full bg-surface rounded-[20px] border-2 border-ink/20 shadow-step">
      <div className="px-4 py-3 border-b border-dashed border-ink/25 rounded-t-[20px] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink text-sm tracking-wide">Sources</h3>
          <p className="text-xs text-muted mt-0.5">
            {sources.length} total / {sources.length - sources.filter((s) => excludedCategories.includes(s.category)).length} active
          </p>
        </div>
        <button
          onClick={onImportJson}
          className="text-xs bg-stamp text-surface font-semibold px-3 py-1 rounded-full border-2 border-stamp shadow-step hover:brightness-110 transition-colors"
        >
          Import JSON
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {sources.length === 0 && (
          <div className="text-center text-muted text-sm py-6">
            <p>No sources yet</p>
            <p className="text-xs mt-1">Import JSON or add places manually</p>
          </div>
        )}

        {/* Active sources grouped by category */}
        {activeCategories.map((cat) => (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                {getCategoryIcon(cat)} {cat}
                <span className="ml-1 text-ink/30">({grouped[cat].length})</span>
              </span>
              <button
                onClick={() => onForgetCategory(cat)}
                className="text-xs text-stamp/70 hover:text-stamp hover:bg-stamp/10 px-1.5 py-0.5 rounded-full border border-stamp/30 transition-colors"
                title={`Forget "${cat}" category`}
              >
                Forget
              </button>
            </div>
            <div className="space-y-1">
              {grouped[cat].map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 p-2 bg-paper rounded-[12px] border border-ink/10 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {source.name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {source.duration_min ? `${source.duration_min}min` : ""}
                      {source.anchor_id ? ` / ${source.anchor_id.replace("anchor_", "")}` : ""}
                      {source.memo ? ` — ${source.memo}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveSource(source.id)}
                    className="text-ink/20 hover:text-stamp text-lg leading-none transition-colors opacity-0 group-hover:opacity-100"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Excluded categories (sources preserved but grayed out) */}
        {(excludedWithSources.length > 0 || excludedWithoutSources.length > 0) && (
          <div className="pt-2 border-t border-dashed border-ink/20">
            <p className="text-xs font-bold text-stamp/80 mb-1.5 tracking-wide">
              Forgotten Categories (memU excluded)
            </p>
            {excludedWithSources.map((cat) => (
              <div key={cat} className="mb-2">
                <div className="flex items-center justify-between p-2 bg-stamp/5 rounded-[12px] border border-dashed border-stamp/30">
                  <span className="text-sm text-stamp/60 line-through">
                    {getCategoryIcon(cat)} {cat} ({grouped[cat].length} sources hidden)
                  </span>
                  <button
                    onClick={() => onRestoreCategory(cat)}
                    className="text-xs text-mapblue hover:text-mapblue/80 px-1.5 py-0.5 rounded-full border border-mapblue/30 hover:bg-mapblue/10 transition-colors"
                  >
                    Restore
                  </button>
                </div>
                <div className="ml-2 mt-1 space-y-0.5">
                  {grouped[cat].map((source) => (
                    <p key={source.id} className="text-xs text-stamp/40 line-through truncate pl-2">
                      {source.name}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {excludedWithoutSources.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between p-2 bg-stamp/5 rounded-[12px] mb-1 border border-dashed border-stamp/30"
              >
                <span className="text-sm text-stamp/60 line-through">
                  {getCategoryIcon(cat)} {cat}
                </span>
                <button
                  onClick={() => onRestoreCategory(cat)}
                  className="text-xs text-mapblue hover:text-mapblue/80 px-1.5 py-0.5 rounded-full border border-mapblue/30 hover:bg-mapblue/10 transition-colors"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add source form */}
      <div className="border-t border-dashed border-ink/25 p-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Place name"
          className="w-full border-2 border-ink/30 rounded-[12px] bg-paper px-3 py-2 text-sm focus:outline-none focus:border-mapblue text-ink placeholder:text-muted/50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAdd();
          }}
        />

        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (cafe, museum, etc.)"
          className="w-full border-2 border-ink/30 rounded-[12px] bg-paper px-3 py-1.5 text-xs focus:outline-none focus:border-mapblue text-ink placeholder:text-muted/50"
        />

        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Memo (optional)"
          className="w-full border-2 border-ink/30 rounded-[12px] bg-paper px-3 py-1.5 text-xs focus:outline-none focus:border-mapblue text-ink placeholder:text-muted/50"
        />

        <button
          onClick={handleAdd}
          disabled={!name.trim() || isAdding}
          className="w-full bg-ink text-surface px-3 py-2 rounded-full text-sm font-semibold tracking-wide hover:bg-ink/85 disabled:bg-muted/40 disabled:text-muted/60 disabled:cursor-not-allowed transition-colors shadow-step"
        >
          {isAdding ? "Adding..." : "+ Add Source"}
        </button>
      </div>
    </div>
  );
}
