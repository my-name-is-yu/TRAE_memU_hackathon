import Anthropic from "@anthropic-ai/sdk";
import { Source } from "@/types/trip";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TRIP_SYSTEM_PROMPT = `あなたは旅行プランナーAIアシスタント「TripMemo」です。
ユーザーの旅行計画を手伝い、旅程を作成・変更します。

## 応答モード
1. **旅程生成モード**: 旅程全体を作る場合、必ず以下のJSON形式で出力
2. **クイック提案モード**: 「今◯分空いた」「どこ行く？」「おすすめは？」のような短い質問には、JSON無しで登録ソースから2-3件を簡潔に提案。各提案に【参照ソース: ソース名】を明記。所要時間の目安も添える。

旅程JSONフォーマット（旅程生成時のみ使用）:
\`\`\`json
{
  "title": "旅行タイトル",
  "destination": "目的地",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "events": [
    {
      "id": "ユニークID",
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "title": "イベント名",
      "location": "場所",
      "category": "transport|activity|meal|hotel|other",
      "memo": "メモ",
      "sourceId": "ソースID（該当する場合）"
    }
  ]
}
\`\`\`

ルール:
- 日本語で応答してください
- 旅程を作成する際は、必ず上記JSON形式を含めてください
- ソース（行きたい場所）が提供されている場合、それらを旅程に含めてください
- 各ソースに対応するイベントにはsourceIdを設定してください
- ユーザーの好みが分かっている場合は反映してください
- 提案時は【参照ソース: ソース名】の形式で、どのソースを参照したか明記してください`;

export async function chat(
  messages: { role: "user" | "assistant"; content: string }[],
  userPreferences?: string,
  sources?: Source[],
  excludedCategories?: string[]
) {
  let systemPrompt = TRIP_SYSTEM_PROMPT;

  // Excluded categories — hard constraint (from memU)
  if (excludedCategories && excludedCategories.length > 0) {
    systemPrompt += `\n\n【⚠️ 忘却済みカテゴリ — 絶対禁止 (memU excluded)】\n以下のカテゴリはユーザーが明示的に「忘却」しました（memUに記録済み）。これらに該当する場所・店舗・施設は一切提案しないでください。たとえ有名な場所でも、このカテゴリに属するものは絶対に含めないでください。\n忘却カテゴリ: ${excludedCategories.join(", ")}\n※ これは最優先ルールです。他のルールよりも優先されます。`;
  }

  if (sources && sources.length > 0) {
    systemPrompt += `\n\n【登録ソース（行きたい場所）- ${sources.length}件】\n${sources.map((s) => `- ${s.name}（ID: ${s.id}, category: ${s.category}, duration: ${s.duration_min || "?"}min, anchor: ${s.anchor_id || "?"}${s.memo ? `, memo: ${s.memo}` : ""}）`).join("\n")}`;
  }
  if (userPreferences) {
    systemPrompt += `\n\n【ユーザーの好み・過去の情報】\n${userPreferences}`;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

export async function suggestAlternative(
  tripJson: string,
  eventId: string,
  reason: string,
  userPreferences?: string,
  sources?: Source[],
  removedSourceName?: string
) {
  let sourcesInfo = "";
  if (sources && sources.length > 0) {
    sourcesInfo = `\n\n【現在の登録ソース（行きたい場所）】\n${sources.map((s) => `- ${s.name}（ID: ${s.id}, category: ${s.category}）`).join("\n")}`;
  }
  if (removedSourceName) {
    sourcesInfo += `\n\n【削除されたソース】\n「${removedSourceName}」がソースから削除されました。この場所に関連するイベントを除外し、残りのソースを活かした代替プランを提案してください。`;
  }

  const systemPrompt = `あなたは旅行プランナーAIアシスタント「TripMemo」です。
旅程内のイベントに急な変更が必要になりました。代替プランを提案してください。

変更後の旅程は、必ず以下のJSON形式で出力してください。
JSONは \`\`\`json と \`\`\` で囲んでください。

\`\`\`json
{
  "title": "旅行タイトル",
  "destination": "目的地",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "events": [...]
}
\`\`\`

ルール:
- 日本語で応答してください
- 変更理由に応じた適切な代替プランを提案してください
- ソースに基づくイベントにはsourceIdを設定してください
${sourcesInfo}
${userPreferences ? `\n【ユーザーの好み・過去の情報】\n${userPreferences}` : ""}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `現在の旅程:\n${tripJson}\n\n変更が必要なイベントID: ${eventId}\n変更理由: ${reason}\n\n適切な代替プランを提案してください。`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}
