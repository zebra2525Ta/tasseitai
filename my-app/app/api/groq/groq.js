// 使い方：呼び出したいファイルで、
// import { generateText } from "./groq.js";　を追加してください。
// その後、generateText関数を呼び出すだけです。
//
// 例：test.js での呼び出し例があります。参考にしてください。

import { searchNotionPages, collectNotionPageInfo } from "../notion/notion.js";

// Notion側の1件あたりのプロンプト行数が多すぎるとプロンプトが肥大化するため、
// 1件あたりの propertiesList 行数と全体の文字数に上限を設ける
const NOTION_MAX_PAGES_FOR_PROMPT = 30;
const NOTION_MAX_PROPERTY_LINES_PER_ITEM = 8;
const NOTION_PROMPT_MAX_CHARS = 6000;

// Notionワークスペース全体から最新の情報を取得する（ホーム画面の全体検索と同じ方式）
async function fetchNotionData() {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    console.error("Notionデータ取得エラー: NOTION_API_KEY が設定されていません");
    return [];
  }

  try {
    // query="" かつ filterType未指定 = ワークスペース全体（ページ＋データベース）を対象にする
    const pages = await searchNotionPages(notionApiKey, "", 50, 3, null);
    return pages.map((page) => collectNotionPageInfo(page));
  } catch (error) {
    console.error("Notionデータ取得エラー:", error.message);
    return [];
  }
}

// Notionの検索結果を、AIが読みやすい形式のテキストに整形する
function formatNotionResultsForPrompt(notionResults) {
  const lines = [];

  for (const item of notionResults.slice(0, NOTION_MAX_PAGES_FOR_PROMPT)) {
    const header = `[${item.object === "database" ? "データベース" : "ページ"}] ${item.title || "(無題)"}`;
    const propertyLines = (item.propertiesList || []).slice(0, NOTION_MAX_PROPERTY_LINES_PER_ITEM);
    lines.push(header, ...propertyLines, "");
  }

  let text = lines.join("\n").trim();
  if (text.length > NOTION_PROMPT_MAX_CHARS) {
    text = text.slice(0, NOTION_PROMPT_MAX_CHARS) + "\n...(以下省略)";
  }
  return text;
}


// Noirのキャラクター設定（アメとムチ）。全ての応答にこの人格を適用する
const NOIR_SYSTEM_PROMPT = [
  "あなたは「Noir」という名前のパーソナルアシスタントAIです。",
  "ユーザーの生活・タスク管理をサポートするのが役目です。",
  "",
  "口調・キャラクター:",
  "- 基本はフレンドリーで親しみやすい口調で接してください。",
  "- ただし、期限を過ぎたタスクを放置している、やるべきことをサボっている様子が見えるときは、遠慮せずはっきりと指摘し、時には厳しく叱咤激励してください（アメとムチ）。",
  "- 順調に進んでいるときや何かを達成できたときは、きちんと労い、褒めてください。",
  "",
  "回答スタイル:",
  "- Notionのデータを渡された場合でも、それをそのまま表やリストとして機械的に列挙するだけの回答はしないでください。",
  "- 必ず、データの内容を踏まえた一言コメント（進み具合への指摘、励まし、次にやるべきことの提案など）を添えてください。",
  "- 簡潔に、会話として自然な文章で答えてください。",
  "- ただし「買い物リストがほしい」のように一覧そのものを求められたときは例外です。商品名・タスク名など名前の列だけの簡潔な表（Markdownテーブル）で示してください。数量やメモなどの詳細は、特に聞かれない限り省略してください。表を出す場合も、その前後に短い一言コメントは添えてください。",
].join("\n");

// Node標準fetchを使う
//入力: promptText (string) - ユーザからの質問や指示
//出力: 生成されたテキスト (string) - GROQ APIからの応答
export async function generateText(promptText) {
  if (typeof promptText !== "string" || promptText.trim() === "") {
    throw new Error("generateText requires a non-empty string promptText argument");
  }

  const groqApiKey = (process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY)?.trim();
  if (!groqApiKey) {
    throw new Error(
      "GROQ_API_KEY が設定されていません。Vercel の環境変数に GROQ_API_KEY を追加してください。"
    );
  }

  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: NOIR_SYSTEM_PROMPT },
          { role: "user", content: promptText.trim() },
        ],
      }),
    });
  } catch (error) {
    throw new Error(`GROQ API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!res.ok) {
    const responseText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${responseText}`);
  }

  const data = await res.json().catch(() => null);
  return typeof data?.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content.trim()
    : "";
}

async function buildNotionPrompt(question) {
  const questionText = typeof question === "string" ? question.trim() : "";
  if (!questionText) {
    throw new Error("質問文が必要です");
  }

  const notionResults = await fetchNotionData();
  const propertiesText = formatNotionResultsForPrompt(notionResults);

  return [
    "以下は Notion ワークスペースから取得した情報の一覧です。",
    "これらのデータをもとに、質問に回答してください。",
    "",
    propertiesText || "(該当するNotionデータが見つかりませんでした)",
    "",
    `質問: ${questionText}`,
  ].join("\n");
}

export { buildNotionPrompt };

export async function generateTextFromNotionData(question) {
  const promptText = await buildNotionPrompt(question);
  return generateText(promptText);
}

