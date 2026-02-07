"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trip, Source, ChatMessage, TripEvent, TripImportJson, SuggestResult } from "@/types/trip";
import {
  getCurrentTrip,
  saveCurrentTrip,
  clearCurrentTrip,
  getSources,
  addSource,
  removeSource,
  getExcludedCategories,
  addExcludedCategory,
  removeExcludedCategory,
  clearExcludedCategories,
  getActiveSources,
  importTripFromJson,
  generateId,
} from "@/lib/storage";
import SourcePanel from "@/components/SourcePanel";
import Timeline from "@/components/Timeline";
import ChatPanel from "@/components/ChatPanel";
import ChangeModal from "@/components/ChangeModal";

// ========================================================
// Demo-fixed parameters (Day 3 museum scenario)
// blk_d3_museum_long: scheduled 10:00–15:00, actual end 13:30
// blk_d3_next_block_fixed: starts 15:00
// free_time = 90min, anchor = Day3 base = anchor_covent_garden
// ========================================================
const DEMO_ANCHOR = "anchor_covent_garden";
const DEMO_FREE_TIME = 90;

// --- Detect: "ミュージアムが早く終わった" (phrase 1) ---
function isMuseumEarlyFinish(msg: string): boolean {
  return (
    (msg.includes("ミュージアム") || msg.includes("museum")) &&
    (msg.includes("早く終わった") || msg.includes("早く終わる") || msg.includes("早く終わ") || msg.includes("どこ行こう"))
  );
}

// --- Detect: "カフェはもう十分" (phrase 2) ---
function isCafeForgetAndResuggest(msg: string): boolean {
  return (
    (msg.includes("カフェ") || msg.includes("cafe") || msg.includes("coffee")) &&
    (msg.includes("十分") || msg.includes("別の") || msg.includes("いらない") || msg.includes("忘れて") || msg.includes("忘却"))
  );
}

// --- General category forget detection ---
const CATEGORY_KEYWORDS: Record<string, string> = {
  "カフェ": "cafe", "cafe": "cafe", "coffee": "cafe", "コーヒー": "cafe",
  "グルメ": "food", "食事": "food", "レストラン": "food",
  "museum": "museum", "美術館": "museum", "博物館": "museum",
  "公園": "park", "park": "park",
  "market": "market", "マーケット": "market",
};

function detectCategoryForget(message: string): string | null {
  const forgetPatterns = ["いらない", "忘却", "忘れて", "除外", "不要", "やめ", "消して", "forget", "exclude", "十分"];
  const hasForgetIntent = forgetPatterns.some((p) => message.toLowerCase().includes(p));
  if (!hasForgetIntent) return null;
  for (const [keyword, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (message.toLowerCase().includes(keyword.toLowerCase())) return cat;
  }
  return null;
}

function extractTripJson(text: string): Partial<Trip> | null {
  if (!text) return null;
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export default function HomePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [changeEvent, setChangeEvent] = useState<TripEvent | null>(null);
  const [isChangeLoading, setIsChangeLoading] = useState(false);

  // Remember last suggest params for auto-re-suggest after forget
  const lastSuggestParams = useRef<{ anchor: string; freeTime: number; message: string } | null>(null);

  // Demo mode: reset all state on every page reload so demo starts fresh
  useEffect(() => {
    clearCurrentTrip();
    clearExcludedCategories();
    localStorage.removeItem("tripmemo_sources");
    setTrip(null);
    setSources([]);
    setExcludedCategories([]);
    setMessages([]);
    lastSuggestParams.current = null;
    console.log("[RESET] Page loaded — all state cleared for demo");
  }, []);

  // === JSON Import ===
  const handleImportJson = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/london_trip_3d.json");
      const data: TripImportJson = await res.json();
      const result = importTripFromJson(data);

      setTrip(result.trip);
      setSources(getSources());
      setExcludedCategories(getExcludedCategories());

      const catSummary = Object.entries(result.categoryCount)
        .map(([cat, count]) => `${cat}: ${count}`)
        .join(", ");

      // Detect cafe blocks in timeline
      const cafeBlocks = result.trip.events.filter((e) => e.category === "cafe");
      const cafeBlockInfo = cafeBlocks.length > 0
        ? cafeBlocks.map((b) => `  - ${b.date} ${b.startTime}-${b.endTime} "${b.title}"`).join("\n")
        : "  (なし)";

      console.log(`\n========== [IMPORT] ==========`);
      console.log(`[IMPORT] trip.id: ${data.trip.id}`);
      console.log(`[IMPORT] sources: ${result.sources.length} total`);
      console.log(`[IMPORT] categories: ${catSummary}`);
      console.log(`[IMPORT] cafe sources: ${result.categoryCount["cafe"] || 0}`);
      console.log(`[IMPORT] timeline events: ${result.trip.events.length}`);
      console.log(`[IMPORT] cafe blocks in timeline:`);
      cafeBlocks.forEach((b) => console.log(`  ${b.date} ${b.startTime}-${b.endTime} "${b.title}"`));
      console.log(`==============================\n`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `「${result.trip.title}」を読み込みました\n\nソース: ${result.sources.length}件\nカテゴリ: ${catSummary}\nカフェ系ソース: ${result.categoryCount["cafe"] || 0}件\n\nタイムライン: ${result.trip.events.length}ブロック\nカフェブロック（Day1/Day2）:\n${cafeBlockInfo}\n\nDay3: ミュージアム 10:00-15:00 → 次ブロック 15:00\nデモ準備完了！`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Import error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "インポートに失敗しました。", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // === Source operations ===
  const handleAddSource = useCallback(async (name: string, category: string, memo: string) => {
    const source: Source = { id: generateId(), name, category, memo };
    addSource(source);
    setSources(getSources());
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "memorize-source", sourceName: name, category, memo }),
      });
    } catch (e) { console.error("memU memorize-source failed:", e); }
  }, []);

  const handleRemoveSource = useCallback(async (id: string) => {
    const removed = removeSource(id);
    setSources(getSources());
    if (removed) {
      try {
        await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "forget-source", sourceName: removed.name }),
        });
      } catch (e) { console.error("memU forget-source failed:", e); }
    }
  }, []);

  // === Suggest (deterministic ranking) ===
  const handleSuggest = useCallback(
    async (anchor_id: string, free_time_min: number, message: string): Promise<string> => {
      const allSources = getSources();
      const excluded = getExcludedCategories();

      // Save for potential re-suggest
      lastSuggestParams.current = { anchor: anchor_id, freeTime: free_time_min, message };

      console.log(`\n========== [SUGGEST] ==========`);
      console.log(`[SUGGEST] anchor=${anchor_id}, free_time=${free_time_min}min`);
      console.log(`[SUGGEST] excluded_categories: [${excluded.join(", ")}]`);

      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: allSources, excludedCategories: excluded, anchor_id, free_time_min, message }),
        });
        const data = await res.json();

        console.log(`[SUGGEST] debug:`, data.debug);
        console.log(`[SUGGEST] cafe_in_results: ${data.debug?.cafe_in_results}`);
        console.log(`===============================\n`);

        const suggestions: SuggestResult[] = data.suggestions || [];
        let content = `**おすすめスポット** （空き${free_time_min}分 / ${anchor_id.replace("anchor_", "")}周辺）\n\n`;

        if (suggestions.length === 0) {
          content += "条件に合うスポットが見つかりませんでした。\n";
        } else {
          suggestions.forEach((s: SuggestResult, i: number) => {
            content += `${i + 1}. **${s.title}** [${s.category}]\n`;
            content += `   約${s.duration_min}分 | ${s.reason}\n\n`;
          });
        }

        content += `---\n除外カテゴリ: [${excluded.join(", ") || "なし"}]`;
        content += ` | カフェ含む: ${data.debug?.cafe_in_results ? "あり" : "なし"}`;
        content += ` | 候補数: ${data.debug?.after_duration}件`;

        return content;
      } catch (error) {
        console.error("Suggest error:", error);
        return "提案の取得に失敗しました。";
      }
    },
    []
  );

  // === Category Forget (THE key feature) ===
  // Sources are NOT deleted. Only the category is marked as excluded in localStorage + memU.
  const handleForgetCategory = useCallback(
    async (category: string): Promise<void> => {
      const allSources = getSources();
      const affectedSources = allSources.filter((s) => s.category === category);

      // Mark as excluded (local cache — instant)
      addExcludedCategory(category);
      setExcludedCategories(getExcludedCategories());
      setSources(getSources()); // sources unchanged, but triggers re-render

      console.log(`\n========== [FORGET CATEGORY] ==========`);
      console.log(`[FORGET] category: ${category}`);
      console.log(`[FORGET] affected sources: ${affectedSources.length}`);
      console.log(`[FORGET] source names: ${affectedSources.map((s) => s.name).join(", ")}`);
      console.log(`[FORGET] sources preserved in storage: YES (not deleted)`);

      // Record to memU (the key integration!)
      try {
        const memuRes = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "forget-category",
            category,
            categoryLabel: category,
            sourceNames: affectedSources.map((s) => s.name),
          }),
        });
        const memuData = await memuRes.json();
        console.log(`[FORGET] memU response:`, memuData);
        console.log(`[FORGET] memU status: RECORDED`);
      } catch (e) {
        console.error("[FORGET] memU forget-category failed:", e);
      }

      // Verify from memU
      try {
        const verifyRes = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retrieve-excluded" }),
        });
        const verifyData = await verifyRes.json();
        console.log(`[FORGET] memU verify (retrieve-excluded):`, verifyData);
      } catch (e) {
        console.error("[FORGET] memU verify failed:", e);
      }

      console.log(`[FORGET] excluded_categories now: [${getExcludedCategories().join(", ")}]`);
      console.log(`========================================\n`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `「${category}」カテゴリを忘却しました！\n\n- ${affectedSources.length}件のソースを除外: ${affectedSources.map((s) => s.name).join(", ")}\n- ソースはデータ上保持（削除なし）\n- memUに記録済み\n- 除外カテゴリ: [${getExcludedCategories().join(", ")}]`,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const handleRestoreCategory = useCallback((category: string) => {
    removeExcludedCategory(category);
    setExcludedCategories(getExcludedCategories());
    setSources(getSources());
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `「${category}」カテゴリを復元しました。`, timestamp: new Date().toISOString() },
    ]);
  }, []);

  // === Change request ===
  const handleChangeRequest = useCallback((eventId: string) => {
    const event = trip?.events.find((e) => e.id === eventId);
    if (event) setChangeEvent(event);
  }, [trip]);

  const handleChangeSubmit = useCallback(async (reason: string) => {
    if (!trip || !changeEvent) return;
    setIsChangeLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "change", tripJson: JSON.stringify(trip), eventId: changeEvent.id, reason,
          sources: getActiveSources(), excludedCategories: getExcludedCategories(),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Change "${changeEvent.title}": ${reason}`, timestamp: new Date().toISOString() },
        { role: "assistant", content: data.response || "", timestamp: new Date().toISOString() },
      ]);
      const updatedData = extractTripJson(data.response || "");
      if (updatedData?.events) {
        const updatedTrip: Trip = { ...trip, ...updatedData, events: updatedData.events.map((e) => ({ ...e, id: e.id || generateId() })) };
        saveCurrentTrip(updatedTrip);
        setTrip(updatedTrip);
      }
      setChangeEvent(null);
    } catch (error) { console.error("Change error:", error); }
    finally { setIsChangeLoading(false); }
  }, [trip, changeEvent]);

  // ============================================================
  // MAIN CHAT HANDLER — routes to the correct demo action
  // ============================================================
  const handleChatSend = useCallback(
    async (content: string) => {
      // === PHRASE 1: "今のミュージアムが１時間半早く終わった。どこ行こう" ===
      if (isMuseumEarlyFinish(content)) {
        console.log(`\n========== [DEMO PHRASE 1] ==========`);
        console.log(`[DEMO] Detected: museum early finish`);
        console.log(`[DEMO] Block: blk_d3_museum_long, scheduled_end=15:00, actual_end=13:30`);
        console.log(`[DEMO] free_time_min=${DEMO_FREE_TIME}, anchor=${DEMO_ANCHOR}`);
        console.log(`=====================================\n`);

        setMessages((prev) => [
          ...prev,
          { role: "user", content, timestamp: new Date().toISOString() },
          {
            role: "assistant",
            content: `検出: Day3 ミュージアムが予定より早く終了（13:30 / 予定15:00）\n空き時間 = 90分 | エリア = Covent Garden\nおすすめを検索中...`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(true);

        const suggestContent = await handleSuggest(DEMO_ANCHOR, DEMO_FREE_TIME, content);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: suggestContent, timestamp: new Date().toISOString() },
        ]);
        setIsLoading(false);
        return;
      }

      // === PHRASE 2: "カフェはもう十分かも。別のを提案して" ===
      if (isCafeForgetAndResuggest(content)) {
        console.log(`\n========== [DEMO PHRASE 2] ==========`);
        console.log(`[DEMO] Detected: cafe forget + re-suggest`);
        console.log(`=====================================\n`);

        setMessages((prev) => [
          ...prev,
          { role: "user", content, timestamp: new Date().toISOString() },
        ]);

        const currentExcluded = getExcludedCategories();
        if (currentExcluded.includes("cafe")) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `「カフェ」カテゴリは既に忘却済みです。`, timestamp: new Date().toISOString() },
          ]);
          return;
        }

        setIsLoading(true);

        // Step A: Forget cafe category (memU + localStorage)
        await handleForgetCategory("cafe");

        // Step B: Auto re-suggest with same params (cafe now excluded)
        const params = lastSuggestParams.current || { anchor: DEMO_ANCHOR, freeTime: DEMO_FREE_TIME, message: content };
        console.log(`[DEMO] Auto re-suggest after forget: anchor=${params.anchor}, free=${params.freeTime}min`);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `カフェを除外して再検索中...`,
            timestamp: new Date().toISOString(),
          },
        ]);

        const suggestContent = await handleSuggest(params.anchor, params.freeTime, "カフェ以外で提案");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: suggestContent, timestamp: new Date().toISOString() },
        ]);
        setIsLoading(false);
        return;
      }

      // === General category forget (fallback) ===
      const detectedCategory = detectCategoryForget(content);
      if (detectedCategory) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content, timestamp: new Date().toISOString() },
        ]);
        if (getExcludedCategories().includes(detectedCategory)) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `「${detectedCategory}」カテゴリは既に忘却済みです。`, timestamp: new Date().toISOString() },
          ]);
          return;
        }
        await handleForgetCategory(detectedCategory);
        return;
      }

      // === General suggest (matches "N分" + suggest keywords) ===
      const suggestMatch = content.match(/(\d+)\s*(分|min)/);
      const isSuggest = suggestMatch && (
        content.includes("空いた") || content.includes("おすすめ") || content.includes("提案") ||
        content.includes("行ける") || content.includes("suggest") || content.includes("どこ行")
      );
      if (isSuggest) {
        const freeTime = parseInt(suggestMatch![1], 10);
        const anchorMatch = content.match(/anchor_\w+/);
        const anchor = anchorMatch ? anchorMatch[0] : DEMO_ANCHOR;
        setMessages((prev) => [
          ...prev,
          { role: "user", content, timestamp: new Date().toISOString() },
        ]);
        setIsLoading(true);
        const suggestContent = await handleSuggest(anchor, freeTime, content);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: suggestContent, timestamp: new Date().toISOString() },
        ]);
        setIsLoading(false);
        return;
      }

      // === Normal Claude chat (fallback) ===
      const userMsg: ChatMessage = { role: "user", content, timestamp: new Date().toISOString() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);
      try {
        const activeSources = getActiveSources();
        const excluded = getExcludedCategories();
        const chatMessages: { role: "user" | "assistant"; content: string }[] = [];
        if (trip) {
          chatMessages.push({ role: "user", content: `Current trip: "${trip.title}" (${trip.destination})` });
        }
        chatMessages.push(...newMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: chatMessages, mode: "chat", sources: activeSources, excludedCategories: excluded }),
        });
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.response || "Error", timestamp: new Date().toISOString() }]);
        const updatedData = extractTripJson(data.response || "");
        if (updatedData?.events) {
          const updatedTrip: Trip = {
            title: updatedData.title || trip?.title || "New Trip",
            destination: updatedData.destination || trip?.destination || "",
            startDate: updatedData.startDate || trip?.startDate || "",
            endDate: updatedData.endDate || trip?.endDate || "",
            events: updatedData.events.map((e) => ({ ...e, id: e.id || generateId() })),
            createdAt: trip?.createdAt || new Date().toISOString(),
          };
          saveCurrentTrip(updatedTrip);
          setTrip(updatedTrip);
          setSources(getSources());
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) => [...prev, { role: "assistant", content: "エラーが発生しました。", timestamp: new Date().toISOString() }]);
      } finally { setIsLoading(false); }
    },
    [messages, trip, handleForgetCategory, handleSuggest]
  );

  const handleClearTrip = useCallback(() => {
    clearCurrentTrip();
    clearExcludedCategories();
    setTrip(null);
    setSources([]);
    setExcludedCategories([]);
    setMessages([]);
    localStorage.removeItem("tripmemo_sources");
  }, []);

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {trip && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface border-b-2 border-dashed border-ink/25">
          <div>
            <h2 className="text-lg font-bold text-ink">{trip.title}</h2>
            <p className="text-xs text-muted">{trip.destination} / {trip.startDate} ~ {trip.endDate}</p>
          </div>
          <button onClick={handleClearTrip} className="text-xs text-stamp/70 hover:text-stamp px-2 py-1 rounded-full border border-stamp/25 hover:bg-stamp/10 transition-colors">
            Reset All
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 gap-3 p-3 min-h-0 overflow-hidden">
        <div className="lg:col-span-2 min-h-0 overflow-hidden">
          <SourcePanel
            sources={sources}
            excludedCategories={excludedCategories}
            onAddSource={handleAddSource}
            onRemoveSource={handleRemoveSource}
            onForgetCategory={handleForgetCategory}
            onRestoreCategory={handleRestoreCategory}
            onImportJson={handleImportJson}
          />
        </div>

        <div className="lg:col-span-3 min-h-0 overflow-hidden">
          <div className="bg-surface rounded-[20px] border-2 border-ink/20 shadow-step h-full flex flex-col">
            <div className="px-4 py-3 border-b border-dashed border-ink/25 rounded-t-[20px]">
              <h3 className="font-bold text-ink text-sm tracking-wide">Timeline</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Timeline events={trip?.events || []} sources={sources} onChangeRequest={handleChangeRequest} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 min-h-0 overflow-hidden">
          <ChatPanel messages={messages} onSend={handleChatSend} isLoading={isLoading} placeholder="Type your message..." />
        </div>
      </div>

      {changeEvent && (
        <ChangeModal event={changeEvent} onSubmit={handleChangeSubmit} onClose={() => setChangeEvent(null)} isLoading={isChangeLoading} />
      )}
    </div>
  );
}
