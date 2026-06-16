import { generateText } from "./groq.js";

/**
 * chatから渡される文字列をgeneratTextで処理するテスト
 */
async function testGroqCall() {
  console.log("=== Groq API テスト開始 ===\n");

  // テストケース1: 通常の文字列
  const testPrompt1 = "大阪の明日の天気を教えて";
  console.log(`テスト1: "${testPrompt1}"`);
  try {
    const result = await generateText(testPrompt1);
    console.log("✓ 成功");
    console.log(`  結果: ${result.substring(0, 100)}...`);
  } catch (error) {
    console.log("✗ エラー:", error.message);
  }
  console.log();

  // テストケース2: 別の質問
  const testPrompt2 = "JavaScriptとは何ですか？";
  console.log(`テスト2: "${testPrompt2}"`);
  try {
    const result = await generateText(testPrompt2);
    console.log("✓ 成功");
    console.log(`  結果: ${result.substring(0, 100)}...`);
  } catch (error) {
    console.log("✗ エラー:", error.message);
  }
  console.log();

  // テストケース3: 空文字列（エラーハンドリング）
  console.log("テスト3: 空文字列のテスト");
  try {
    const result = await generateText("");
    console.log("✓ 成功（予期しない）");
  } catch (error) {
    console.log("✓ 期待通りエラー:", error.message);
  }
  console.log();

  // テストケース4: 非文字列（エラーハンドリング）
  console.log("テスト4: 非文字列のテスト");
  try {
    const result = await generateText(12345);
    console.log("✓ 成功（予期しない）");
  } catch (error) {
    console.log("✓ 期待通りエラー:", error.message);
  }
  console.log();

  console.log("=== テスト終了 ===");
}

// 環境変数確認
if (!process.env.GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY が設定されていません");
  console.warn("   テスト前に .env ファイルまたは環境変数を設定してください\n");
}

// テスト実行
testGroqCall().catch(console.error);
