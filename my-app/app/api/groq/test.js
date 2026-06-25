import assert from "node:assert/strict";
import { buildNotionPrompt, generateTextFromNotionData } from "./groq.js";
import { getSavedNotionTestData } from "../notion/notion.js";

/**
 * groq.js の Notion参照データ保存仕様を検証するテスト
 */
async function testGroqNotionReference() {
  console.log("=== groq.js Notion参照テスト開始 ===\n");

  const question = "このタスクの要点を簡潔にまとめてください。";
  const notionData = getSavedNotionTestData();

  const prompt = buildNotionPrompt(question, notionData);
  console.log("Generated prompt:\n", prompt, "\n");

  assert(prompt.includes("Name: テストタスク"), "promptには保存されたNotionのNameデータが含まれている必要があります");
  assert(
    prompt.includes("Description: これは参照用のNotionデータです。"),
    "promptには保存されたNotionのDescriptionデータが含まれている必要があります"
  );
  assert(prompt.includes("- Name: テストタスク"), "promptには渡された notionData の行が - プレフィックス付きで含まれている必要があります");
  assert(prompt.includes(`質問: ${question}`), "promptには質問文が含まれている必要があります");

  console.log("✓ saved Notion data and supplied data are both present in normalizedItems\n");

  if (process.env.GROQ_API_KEY) {
    const result = await generateTextFromNotionData(question, notionData);
    console.log("✓ generateTextFromNotionData executed successfully");
    console.log(`  結果: ${result.substring(0, 100)}...\n`);
  } else {
    console.log("⚠️ GROQ_API_KEY が設定されていないため、API呼び出しテストはスキップします。\n");
  }

  console.log("=== テスト終了 ===");
}

await testGroqNotionReference();
