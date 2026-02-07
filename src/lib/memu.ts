const MEMU_BASE_URL = "https://api.memu.so";
const AGENT_ID = "tripmemo-agent";

export async function memorize(
  conversationContent: { role: string; content: string; created_at: string }[],
  userId: string
) {
  const res = await fetch(`${MEMU_BASE_URL}/api/v3/memory/memorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MEMU_API_KEY}`,
    },
    body: JSON.stringify({
      conversation: conversationContent.map((msg) => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      })),
      modality: "conversation",
      user_id: userId,
      agent_id: AGENT_ID,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("memU memorize error:", res.status, text);
    return null;
  }
  return res.json();
}

export async function memorizeSource(sourceName: string, category: string, memo: string, userId: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const content = `ユーザーは「${sourceName}」（カテゴリ: ${category}）に行きたいと言っています。${memo ? `メモ: ${memo}` : ""}`;

  return memorize(
    [
      { role: "user", content, created_at: now },
      {
        role: "assistant",
        content: `「${sourceName}」をソースとして記録しました。旅程生成時に考慮します。`,
        created_at: now,
      },
    ],
    userId
  );
}

export async function forget(sourceName: string, userId: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const content = `ユーザーは「${sourceName}」をソースから削除しました。この場所にはもう行きません。旅程から除外してください。「${sourceName}」は忘却対象です。`;

  return memorize(
    [
      { role: "user", content: `「${sourceName}」を削除します。もう行きません。`, created_at: now },
      { role: "assistant", content, created_at: now },
    ],
    userId
  );
}

// --- Category-level forget (THE key feature) ---
// Records to memU that the user no longer wants this entire category.
// Sources are NOT deleted — only the "intent" is forgotten.
export async function forgetCategory(
  category: string,
  categoryLabel: string,
  sourceNames: string[],
  userId: string
) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const sourceList = sourceNames.length > 0
    ? `該当ソース: ${sourceNames.join("、")}`
    : "";

  const content = `ユーザーは「${categoryLabel}」(${category}) カテゴリ全体を忘却しました。${sourceList}。今後「${categoryLabel}」に該当する場所は一切提案しないでください。ユーザーは${categoryLabel}系に興味がなくなりました。このカテゴリの記憶はすべて無効です。excluded_categories に "${category}" を追加しました。`;

  console.log(`[memU FORGET] category=${category}, label=${categoryLabel}, sources=${sourceNames.length}件`);

  return memorize(
    [
      {
        role: "user",
        content: `${categoryLabel}系(${category})はもういらない。全部忘れて。${sourceList}`,
        created_at: now,
      },
      {
        role: "assistant",
        content,
        created_at: now,
      },
    ],
    userId
  );
}

// --- Retrieve excluded categories info from memU ---
// Queries memU to verify what categories have been forgotten.
// Used for logging/verification in demo.
export async function retrieveExcludedInfo(userId: string) {
  const query = "ユーザーが忘却・除外・excluded したカテゴリは何ですか？excluded_categories の一覧を教えてください。";
  console.log(`[memU RETRIEVE] querying excluded categories for user=${userId}`);
  const result = await retrieve(query, userId);
  console.log(`[memU RETRIEVE] excluded info result:`, JSON.stringify(result, null, 2));
  return result;
}

export async function retrieve(query: string, userId: string) {
  const res = await fetch(`${MEMU_BASE_URL}/api/v3/memory/retrieve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MEMU_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      user_id: userId,
      agent_id: AGENT_ID,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("memU retrieve error:", res.status, text);
    return null;
  }
  return res.json();
}
