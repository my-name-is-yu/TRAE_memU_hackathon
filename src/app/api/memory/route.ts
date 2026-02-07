import { NextRequest, NextResponse } from "next/server";
import { memorize, memorizeSource, forget, forgetCategory, retrieve, retrieveExcludedInfo } from "@/lib/memu";

const USER_ID = "tripmemo-demo-user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, query, content, sourceName, category, categoryLabel, sourceNames, memo } = body;

    if (action === "retrieve") {
      const result = await retrieve(query || "ユーザーの好みを教えてください", USER_ID);
      return NextResponse.json({ result });
    }

    if (action === "memorize") {
      const result = await memorize(content, USER_ID);
      return NextResponse.json({ result });
    }

    if (action === "memorize-source") {
      const result = await memorizeSource(sourceName, category || "other", memo || "", USER_ID);
      return NextResponse.json({ result });
    }

    if (action === "forget-source") {
      const result = await forget(sourceName, USER_ID);
      return NextResponse.json({ result });
    }

    if (action === "forget-category") {
      console.log(`[API forget-category] category=${category}, label=${categoryLabel}, sources=${sourceNames?.length || 0}`);
      const result = await forgetCategory(
        category,
        categoryLabel || category,
        sourceNames || [],
        USER_ID
      );
      console.log(`[API forget-category] memU response:`, JSON.stringify(result));
      return NextResponse.json({ result, status: "ok", excluded_category: category });
    }

    if (action === "retrieve-excluded") {
      console.log(`[API retrieve-excluded] querying memU for excluded categories`);
      const result = await retrieveExcludedInfo(USER_ID);
      return NextResponse.json({ result });
    }

    if (action === "retrieve-sources") {
      const result = await retrieve(
        "ユーザーが行きたいと言っている場所、ソースとして登録された場所を教えてください",
        USER_ID
      );
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Memory API error:", error);
    return NextResponse.json(
      { error: "メモリAPIでエラーが発生しました" },
      { status: 500 }
    );
  }
}
