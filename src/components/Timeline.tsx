"use client";

import { TripEvent, Source } from "@/types/trip";

interface TimelineProps {
  events: TripEvent[];
  sources: Source[];
  onChangeRequest: (eventId: string) => void;
}

const categoryIcons: Record<string, string> = {
  transport: "🚃",
  activity: "🏛️",
  meal: "🍽️",
  hotel: "🏨",
  cafe: "☕",
  museum: "🏛️",
  market: "🛒",
  viewpoint: "🔭",
  park: "🌿",
  bookstore: "📚",
  neighborhood_walk: "🚶",
  food: "🍽️",
  other: "📌",
};

// Scrapbook palette — muted, warm category colors
const categoryColors: Record<string, string> = {
  transport: "border-mapblue bg-mapblue/10",
  activity: "border-sage bg-sage/10",
  meal: "border-mustard bg-mustard/10",
  hotel: "border-muted bg-muted/10",
  cafe: "border-mustard bg-mustard/10",
  museum: "border-mapblue bg-mapblue/10",
  market: "border-sage bg-sage/10",
  viewpoint: "border-mapblue bg-mapblue/10",
  park: "border-sage bg-sage/10",
  bookstore: "border-muted bg-muted/10",
  neighborhood_walk: "border-sage bg-sage/10",
  food: "border-stamp bg-stamp/10",
  other: "border-muted bg-muted/10",
};

const dotColors: Record<string, string> = {
  transport: "bg-mapblue",
  activity: "bg-sage",
  meal: "bg-mustard",
  hotel: "bg-muted",
  cafe: "bg-mustard",
  museum: "bg-mapblue",
  market: "bg-sage",
  viewpoint: "bg-mapblue",
  park: "bg-sage",
  bookstore: "bg-muted",
  neighborhood_walk: "bg-sage",
  food: "bg-stamp",
  other: "bg-muted",
};

export default function Timeline({ events, sources, onChangeRequest }: TimelineProps) {
  const grouped: Record<string, TripEvent[]> = {};
  events.forEach((evt) => {
    if (!grouped[evt.date]) grouped[evt.date] = [];
    grouped[evt.date].push(evt);
  });

  const sortedDates = Object.keys(grouped).sort();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

  const getSourceName = (sourceId?: string) => {
    if (!sourceId) return null;
    return sources.find((s) => s.id === sourceId)?.name || null;
  };

  return (
    <div className="space-y-6">
      {sortedDates.map((date, dateIdx) => (
        <div key={date}>
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <span className="bg-stamp text-surface text-xs font-bold px-2.5 py-0.5 rounded-full border-2 border-stamp shadow-step">
              Day {dateIdx + 1}
            </span>
            {formatDate(date)}
          </h3>

          <div className="relative pl-6">
            {/* Dashed timeline line */}
            <div className="absolute left-[9px] top-0 bottom-0 w-0 border-l-2 border-dashed border-ink/20" />

            <div className="space-y-3">
              {grouped[date]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((evt) => {
                  const sourceName = getSourceName(evt.sourceId);
                  return (
                    <div key={evt.id} className="relative">
                      <div
                        className={`absolute -left-[15px] top-3 w-3 h-3 rounded-full border-2 border-surface ${dotColors[evt.category] || dotColors.other}`}
                      />
                      <div
                        className={`border-l-4 rounded-r-[12px] p-3 ${categoryColors[evt.category] || categoryColors.other}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted font-mono">
                                {evt.startTime} - {evt.endTime}
                              </span>
                              <span>{categoryIcons[evt.category] || categoryIcons.other}</span>
                              <span className="text-xs text-ink/40">[{evt.category}]</span>
                              {sourceName && (
                                <span className="text-xs bg-mapblue/15 text-mapblue px-1.5 py-0.5 rounded-full border border-mapblue/20">
                                  {sourceName}
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-ink text-sm">{evt.title}</p>
                            <p className="text-xs text-muted mt-0.5">{evt.location}</p>
                            {evt.memo && (
                              <p className="text-xs text-ink/40 mt-1">{evt.memo}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onChangeRequest(evt.id)}
                            className="text-xs text-stamp/70 hover:text-stamp hover:bg-stamp/10 px-2 py-1 rounded-full border border-stamp/25 transition-colors whitespace-nowrap"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center text-muted py-12">
          <p>No events yet</p>
          <p className="text-xs mt-1">Import JSON to load a trip</p>
        </div>
      )}
    </div>
  );
}
