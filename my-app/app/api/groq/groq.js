// 使い方：呼び出したいファイルで、
// import { generateText } from "./groq.js";　を追加してください。
// その後、generateText関数を呼び出すだけです。
//
// 例：test.js での呼び出し例があります。参考にしてください。

import { queryNotionDatabase, searchNotionPages, collectNotionPageInfo } from "../notion/notion.js";

// Notion側の1件あたりのプロンプト行数が多すぎるとプロンプトが肥大化するため、
// 1件あたりの propertiesList 行数と全体の文字数に上限を設ける
const NOTION_MAX_PAGES_FOR_PROMPT = 30;
const NOTION_MAX_PROPERTY_LINES_PER_ITEM = 8;
const NOTION_PROMPT_MAX_CHARS = 6000;

// 特定のデータベースに話題が絞れるときは、そのデータベースだけをピンポイントで取得する。
// ワークスペース全体を毎回渡すと関係ないデータに惑わされてAIの回答がぶれるため、
// 話題が特定できる場合は対象を絞り込む。
const NOTION_TOPICS = [
  {
    id: "shopping",
    label: "買い物リスト",
    databaseId: "38fa15fd-a3c1-8049-8041-ebf679d048b2",
    keywords: ["買い物", "ショッピング"],
  },
  {
    id: "todo",
    label: "進捗管理",
    databaseId: "38fa15fd-a3c1-80bd-98d9-ddcfe8406a93",
    keywords: ["進捗", "タスク", "todo", "やること"],
  },
  {
    id: "schedule",
    label: "スケジュール",
    databaseId: "38fa15fd-a3c1-80fa-a200-d99ac64b3409",
    keywords: ["予定", "スケジュール", "カレンダー"],
  },
  {
    id: "jobhunting",
    label: "就活",
    databaseId: "38fa15fd-a3c1-8076-80ad-dc57719ac014",
    keywords: ["就活", "面接", "選考", "エントリー"],
  },
  {
    id: "memo",
    label: "未分類メモ",
    databaseId: "38fa15fd-a3c1-80ed-b95d-ea990af2b963",
    keywords: ["メモ"],
  },
];

// 上記のどのトピックにも当てはまらないが、Notionを見てほしそうな一般的なキーワード
const NOTION_GENERAL_KEYWORDS = ["登録", "確認", "リスト", "notion"];

function detectNotionTopics(text) {
  const lowerText = text.toLowerCase();
  return NOTION_TOPICS.filter((topic) =>
    topic.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))
  );
}

// メッセージの内容からNotionを参照すべきかどうかを判定する
// （NLPや意図分類は行わず、キーワード一致の簡易判定にとどめる）
export function shouldUseNotionContext(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  const lowerText = text.toLowerCase();
  if (detectNotionTopics(text).length > 0) return true;
  return NOTION_GENERAL_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

// 特定のデータベース1つだけを取得する
async function fetchTopicData(topic) {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    console.error("Notionデータ取得エラー: NOTION_API_KEY が設定されていません");
    return [];
  }

  try {
    const pages = await queryNotionDatabase(notionApiKey, topic.databaseId, 50, 2);
    return pages.map((page) => collectNotionPageInfo(page));
  } catch (error) {
    console.error(`Notionデータ取得エラー(${topic.label}):`, error.message);
    return [];
  }
}

// 話題が特定できない場合のフォールバック：ワークスペース全体から取得する
async function fetchWorkspaceData() {
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
function formatNotionResultsForPrompt(notionResults, label) {
  const lines = [];
  if (label) {
    lines.push(`■ ${label}`);
  }

  for (const item of notionResults.slice(0, NOTION_MAX_PAGES_FOR_PROMPT)) {
    const header = `[${item.object === "database" ? "データベース" : "ページ"}] ${item.title || "(無題)"}`;
    const propertyLines = (item.propertiesList || []).slice(0, NOTION_MAX_PROPERTY_LINES_PER_ITEM);
    lines.push(header, ...propertyLines, "");
  }

  return lines.join("\n").trim();
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
  "- ただし「買い物リストがほしい」のように一覧そのものを求められたときは例外です。Markdownテーブル（|で区切る表）や「- 」のようなハイフンの箇条書きは絶対に使わないでください。必ず全角の中点記号「・」を行頭に使い、「・商品名」の形式で名前だけを1行ずつ簡潔に示してください（ハイフンは使用禁止、必ず「・」を使うこと）。数量やメモなどの詳細は、特に聞かれない限り省略してください。箇条書きを出す場合も、その前後に短い一言コメントは添えてください。",
  "- 一覧を箇条書きで示すときは、原則として上から5件までにしてください。渡されたデータが5件を超える場合は、箇条書きの後に「他にもN件あります。詳しくはNotionを確認してね」のように残り件数を一言添えてください（Nは実際の残り件数）。ただしユーザーが「全部」「すべて」「全件」のように明示的に全件表示を求めている場合は、件数制限をせず全件を表示してください。",
  "- 渡されたNotionデータに無関係な一般論やアドバイスを付け加えないでください。渡されたデータの範囲内だけで答えてください。",
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

  const matchedTopics = detectNotionTopics(questionText);
  let propertiesText;

  if (matchedTopics.length > 0) {
    // 話題ごとにデータベースを絞り込んで取得し、無関係なデータを混ぜない
    const sections = await Promise.all(
      matchedTopics.map(async (topic) => {
        const results = await fetchTopicData(topic);
        return formatNotionResultsForPrompt(results, topic.label);
      })
    );
    propertiesText = sections.filter(Boolean).join("\n\n");
  } else {
    // 話題を特定できない場合はワークスペース全体から探す
    const results = await fetchWorkspaceData();
    propertiesText = formatNotionResultsForPrompt(results);
  }

  if (propertiesText.length > NOTION_PROMPT_MAX_CHARS) {
    propertiesText = propertiesText.slice(0, NOTION_PROMPT_MAX_CHARS) + "\n...(以下省略)";
  }

  return [
    "以下は Notion から取得した情報です。",
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
