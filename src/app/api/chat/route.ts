import { NextRequest, NextResponse } from "next/server";
import { chat, suggestAlternative } from "@/lib/claude";
import { memorize, retrieve } from "@/lib/memu";
import { Source } from "@/types/trip";

const USER_ID = "tripmemo-demo-user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, mode, tripJson, eventId, reason, sources, removedSourceName, excludedCategories } = body;

    // Retrieve user preferences from memU
    let preferences: string | undefined;
    try {
      const query =
        mode === "change"
          ? `ユーザーの旅行の好み、食事の好み、予算感、過去の旅行経験を教えてください。変更理由: ${reason}`
          : "ユーザーの旅行の好み、食事の好み、予算感、過去の旅行経験を教えてください。";
      const memResult = await retrieve(query, USER_ID);
      if (memResult?.items?.length > 0) {
        preferences = memResult.items
          .map((item: { content?: string; text?: string }) => item.content || item.text || "")
          .filter(Boolean)
          .join("\n");
      }
    } catch (e) {
      console.error("memU retrieve failed:", e);
    }

    const typedSources: Source[] | undefined = sources;
    let response: string;

    if (mode === "change") {
      response = await suggestAlternative(
        tripJson,
        eventId,
        reason,
        preferences,
        typedSources,
        removedSourceName
      );
    } else {
      response = await chat(messages, preferences, typedSources, excludedCategories);
    }

    // Memorize the conversation to memU (async, don't block response)
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const conversationToMemorize = [
      ...(messages || []).map(
        (m: { role: string; content: string }, i: number) => ({
          role: m.role,
          content: m.content,
          created_at: new Date(Date.now() - (messages.length - i) * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19),
        })
      ),
      { role: "assistant", content: response, created_at: now },
    ];

    memorize(conversationToMemorize, USER_ID).catch((e) =>
      console.error("memU memorize failed:", e)
    );

    console.log(`[CHAT API] mode=${mode}, sources=${typedSources?.length || 0}, excluded=[${excludedCategories?.join(", ") || ""}]`);
    console.log(`[CHAT API] response length: ${response?.length}`);
    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "チャットAPIでエラーが発生しました" },
      { status: 500 }
    );
  }
}
