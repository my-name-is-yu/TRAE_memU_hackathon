import { Trip, Source, TripEvent, TripImportJson } from "@/types/trip";

const TRIP_KEY = "tripmemo_current_trip";
const SOURCES_KEY = "tripmemo_sources";
const EXCLUDED_KEY = "tripmemo_excluded_categories";

// --- Single trip management ---
export function getCurrentTrip(): Trip | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(TRIP_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveCurrentTrip(trip: Trip): void {
  localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
}

export function clearCurrentTrip(): void {
  localStorage.removeItem(TRIP_KEY);
}

// --- Source management ---
export function getSources(): Source[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(SOURCES_KEY);
  return data ? JSON.parse(data) : [];
}

export function setSources(sources: Source[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

export function addSource(source: Source): void {
  const sources = getSources();
  sources.push(source);
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

export function removeSource(id: string): Source | null {
  const sources = getSources();
  const removed = sources.find((s) => s.id === id) || null;
  const filtered = sources.filter((s) => s.id !== id);
  localStorage.setItem(SOURCES_KEY, JSON.stringify(filtered));
  return removed;
}

// --- Excluded categories (for "forget category" feature) ---
// Sources are PRESERVED; only the category is marked as excluded.
export function getExcludedCategories(): string[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(EXCLUDED_KEY);
  return data ? JSON.parse(data) : [];
}

export function addExcludedCategory(category: string): void {
  const excluded = getExcludedCategories();
  if (!excluded.includes(category)) {
    excluded.push(category);
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(excluded));
  }
}

export function removeExcludedCategory(category: string): void {
  const excluded = getExcludedCategories().filter((c) => c !== category);
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify(excluded));
}

export function clearExcludedCategories(): void {
  localStorage.removeItem(EXCLUDED_KEY);
}

// Get sources count by category (for logging)
export function getSourceCountByCategory(): Record<string, number> {
  const sources = getSources();
  const counts: Record<string, number> = {};
  for (const s of sources) {
    counts[s.category] = (counts[s.category] || 0) + 1;
  }
  return counts;
}

// Get active (non-excluded) sources
export function getActiveSources(): Source[] {
  const sources = getSources();
  const excluded = getExcludedCategories();
  return sources.filter((s) => !excluded.includes(s.category));
}

// --- JSON import (london_trip_3d.json format) ---
export function importTripFromJson(data: TripImportJson): {
  trip: Trip;
  sources: Source[];
  categoryCount: Record<string, number>;
} {
  // Map sources: JSON title → Source name, notes → memo
  const sources: Source[] = data.sources.map((s) => ({
    id: s.id,
    name: s.title,
    category: s.category,
    memo: s.notes || "",
    tags: s.tags,
    type: s.type,
    duration_min: s.duration_min,
    anchor_id: s.anchor_id,
    priority: s.priority,
  }));

  // Map timeline blocks → TripEvent[]
  const events: TripEvent[] = [];
  for (const day of data.timeline) {
    for (const block of day.blocks) {
      // Look up source for location/category
      const source = sources.find((s) => s.id === block.source_id);
      events.push({
        id: block.id,
        date: day.date,
        startTime: block.start,
        endTime: block.end,
        title: block.title,
        location: source?.name || block.title,
        category: source?.category || "other",
        memo: source?.memo || "",
        sourceId: block.source_id,
      });
    }
  }

  const trip: Trip = {
    title: data.trip.title,
    destination: `${data.trip.city}, ${data.trip.country}`,
    startDate: data.trip.start_date,
    endDate: data.trip.end_date,
    events,
    createdAt: new Date().toISOString(),
  };

  // Category count for logging
  const categoryCount: Record<string, number> = {};
  for (const s of sources) {
    categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
  }

  // Persist
  setSources(sources);
  saveCurrentTrip(trip);
  clearExcludedCategories();

  return { trip, sources, categoryCount };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
