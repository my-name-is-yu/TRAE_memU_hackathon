// --- Source (supports london_trip_3d.json format) ---
export interface Source {
  id: string;
  name: string;       // mapped from JSON "title"
  category: string;   // cafe, museum, market, viewpoint, park, bookstore, neighborhood_walk, food, shop, other, ...
  memo: string;        // mapped from JSON "notes"
  tags?: string[];
  type?: string;       // "place" | "activity"
  duration_min?: number;
  anchor_id?: string;
  priority?: number;
  memuResourceId?: string;
}

// --- Trip event (timeline block) ---
export interface TripEvent {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  title: string;
  location: string;
  category: string;   // transport, activity, meal, hotel, other, ...
  memo: string;
  sourceId?: string;
}

// --- Trip ---
export interface Trip {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  events: TripEvent[];
  createdAt: string;
}

// --- Chat ---
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChangeRequest {
  eventId: string;
  reason: string;
}

// --- JSON import format (london_trip_3d.json) ---
export interface TripImportJson {
  trip: {
    id: string;
    title: string;
    city: string;
    country: string;
    start_date: string;
    end_date: string;
    timezone?: string;
    assumptions?: Record<string, unknown>;
  };
  taxonomies?: {
    categories: string[];
    tags: string[];
  };
  context?: {
    anchors: { anchor_id: string; label: string; lat: number; lng: number }[];
    user_preferences?: {
      likes: string[];
      dislikes: string[];
      dietary: string[];
      constraints: string[];
    };
  };
  sources: {
    id: string;
    type?: string;
    title: string;
    category: string;
    tags?: string[];
    anchor_id?: string;
    duration_min?: number;
    priority?: number;
    notes?: string;
  }[];
  timeline: {
    day: string;
    date: string;
    base_anchor_id?: string;
    blocks: {
      id: string;
      start: string;
      end: string;
      title: string;
      source_id?: string;
    }[];
  }[];
}

// --- Suggest request/response ---
export interface SuggestRequest {
  anchor_id: string;
  free_time_min: number;
  message?: string;
}

export interface SuggestResult {
  title: string;
  category: string;
  duration_min: number;
  reason: string;
  source_id: string;
  anchor_id?: string;
  priority: number;
}
