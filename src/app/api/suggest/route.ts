import { NextRequest, NextResponse } from "next/server";
import { SuggestResult } from "@/types/trip";

// Deterministic suggestion engine.
// Filters sources by anchor proximity + duration fit + excluded categories.
// Returns top candidates with debug info.

interface SourceRecord {
  id: string;
  name: string;
  category: string;
  memo: string;
  duration_min?: number;
  anchor_id?: string;
  priority?: number;
  tags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sources,
      excludedCategories,
      anchor_id,
      free_time_min,
      message,
    }: {
      sources: SourceRecord[];
      excludedCategories: string[];
      anchor_id: string;
      free_time_min: number;
      message?: string;
    } = body;

    console.log(`\n========== [SUGGEST] ==========`);
    console.log(`[SUGGEST] anchor_id=${anchor_id}, free_time_min=${free_time_min}`);
    console.log(`[SUGGEST] total sources: ${sources.length}`);
    console.log(`[SUGGEST] excluded categories (from memU/local): [${excludedCategories.join(", ")}]`);

    // Step 1: Filter by excluded categories
    const afterExclude = sources.filter((s) => !excludedCategories.includes(s.category));
    console.log(`[SUGGEST] after exclude filter: ${afterExclude.length} sources`);

    // Log which categories were removed
    const excludedSources = sources.filter((s) => excludedCategories.includes(s.category));
    if (excludedSources.length > 0) {
      console.log(`[SUGGEST] EXCLUDED sources (${excludedSources.length}):`,
        excludedSources.map((s) => `  ${s.name} [${s.category}]`).join(", "));
    }

    // Step 2: Filter by duration (must fit in free time)
    const afterDuration = afterExclude.filter(
      (s) => !s.duration_min || s.duration_min <= free_time_min
    );
    console.log(`[SUGGEST] after duration filter (≤${free_time_min}min): ${afterDuration.length} sources`);

    // Step 3: Score each candidate
    const scored = afterDuration.map((s) => {
      let score = (s.priority || 3) * 10; // base: priority * 10

      // Anchor match bonus
      if (s.anchor_id === anchor_id) {
        score += 30;
      }

      // Duration fit bonus: any duration that fits gets a bonus proportional to usage
      if (s.duration_min && s.duration_min <= free_time_min) {
        const fitRatio = s.duration_min / free_time_min;
        score += fitRatio * 15;
      }

      // Message intent matching (simple keyword check)
      if (message) {
        const lowerMsg = message.toLowerCase();
        const cafeKeywords = ["カフェ", "coffee", "cafe", "コーヒー"];
        const museumKeywords = ["museum", "美術館", "博物館", "ミュージアム"];
        const marketKeywords = ["market", "マーケット", "市場"];

        if (cafeKeywords.some((k) => lowerMsg.includes(k)) && s.category === "cafe") {
          score += 20;
        }
        if (museumKeywords.some((k) => lowerMsg.includes(k)) && s.category === "museum") {
          score += 20;
        }
        if (marketKeywords.some((k) => lowerMsg.includes(k)) && s.category === "market") {
          score += 20;
        }
      }

      return { source: s, score };
    });

    // Step 4: Sort by score desc, take top 3
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);

    const suggestions: SuggestResult[] = top.map((item) => ({
      title: item.source.name,
      category: item.source.category,
      duration_min: item.source.duration_min || 30,
      reason: buildReason(item.source, anchor_id, free_time_min),
      source_id: item.source.id,
      anchor_id: item.source.anchor_id,
      priority: item.source.priority || 3,
    }));

    // Debug log
    console.log(`[SUGGEST] top ${suggestions.length} candidates:`);
    suggestions.forEach((s, i) => {
      console.log(`  #${i + 1}: ${s.title} [${s.category}] ${s.duration_min}min (score: ${top[i].score.toFixed(1)})`);
    });

    // Verify no excluded categories in results
    const resultCategories = suggestions.map((s) => s.category);
    const leakedExcluded = resultCategories.filter((c) => excludedCategories.includes(c));
    if (leakedExcluded.length > 0) {
      console.error(`[SUGGEST] BUG: excluded category leaked into results:`, leakedExcluded);
    } else {
      console.log(`[SUGGEST] VERIFIED: 0 excluded categories in results`);
    }
    console.log(`==============================\n`);

    return NextResponse.json({
      suggestions,
      debug: {
        total_sources: sources.length,
        excluded_categories: excludedCategories,
        excluded_source_count: excludedSources.length,
        after_exclude: afterExclude.length,
        after_duration: afterDuration.length,
        result_categories: resultCategories,
        cafe_in_results: resultCategories.includes("cafe"),
      },
    });
  } catch (error) {
    console.error("Suggest API error:", error);
    return NextResponse.json({ error: "Suggest error" }, { status: 500 });
  }
}

function buildReason(source: SourceRecord, queryAnchor: string, freeTime: number): string {
  const parts: string[] = [];
  if (source.anchor_id === queryAnchor) {
    parts.push("現在地の近く");
  }
  if (source.duration_min && source.duration_min <= freeTime) {
    parts.push(`${freeTime}分に収まる（所要約${source.duration_min}分）`);
  }
  if (source.priority && source.priority >= 4) {
    parts.push("優先度高");
  }
  if (source.memo) {
    parts.push(source.memo);
  }
  return parts.join(" / ") || "近くで利用可能";
}
