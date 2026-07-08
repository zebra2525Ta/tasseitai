// 使い方：呼び出したいファイルで、
// import { generateText } from "./groq.js";　を追加してください。
// その後、generateText関数を呼び出すだけです。
//
// 例：test.js での呼び出し例があります。参考にしてください。

import { queryNotionDatabase, searchNotionPages, collectNotionPageInfo, createDatabasePage } from "../notion/notion.js";

// Notion側の1件あたりのプロンプト行数が多すぎるとプロンプトが肥大化するため、
// 1件あたりの propertiesList 行数と全体の文字数に上限を設ける
const NOTION_MAX_PAGES_FOR_PROMPT = 30;
const NOTION_MAX_PROPERTY_LINES_PER_ITEM = 8;
const NOTION_PROMPT_MAX_CHARS = 6000;

// 特定のデータベースに話題が絞れるときは、そのデータベースだけをピンポイントで取得する。
// ワークスペース全体を毎回渡すと関係ないデータに惑わされてAIの回答がぶれるため、
// 話題が特定できる場合は対象を絞り込む。
export const NOTION_TOPICS = [
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

export function detectNotionTopics(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const lowerText = text.toLowerCase();
  return NOTION_TOPICS.filter((topic) =>
    topic.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))
  );
}

// どのトピックにも当てはまらないが、Notionを見てほしそうな一般的なキーワードを含むかどうか
export function hasGeneralNotionIntent(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  const lowerText = text.toLowerCase();
  return NOTION_GENERAL_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

// 「登録して」「追加して」のような、Notionへの新規登録を意図する動詞を含むかどうか
const REGISTER_VERBS = ["登録", "追加", "入れて"];

export function hasRegisterIntent(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  return REGISTER_VERBS.some((verb) => text.includes(verb));
}

// トピックごとの登録スキーマ。Notionの実際のプロパティ型（GET /api/notion?databaseId=...で確認済み）に合わせてある。
// titleProperty: タイトル（名前）として使うプロパティ名
// fields: タイトル以外に埋められるプロパティの定義（type は Notion API のプロパティ型と一致させる）
const TOPIC_REGISTRATION_SCHEMAS = {
  shopping: {
    titleProperty: "商品名",
    fields: [
      { key: "quantity", property: "数量", type: "number", label: "数量", default: 1 },
      { key: "memo", property: "メモ", type: "rich_text", label: "メモ", default: "" },
    ],
  },
  todo: {
    titleProperty: "タスク名",
    fields: [
      { key: "status", property: "ステータス", type: "status", label: "ステータス", default: "未着手", options: ["未着手", "進行中", "完了"] },
      { key: "priority", property: "優先度", type: "select", label: "優先度", default: "中", options: ["高", "中", "低"] },
      { key: "dueDate", property: "期日", type: "date", label: "期日", default: null },
      { key: "description", property: "説明", type: "rich_text", label: "説明", default: "" },
    ],
  },
  schedule: {
    titleProperty: "予定",
    fields: [
      { key: "dueDate", property: "日時", type: "date", label: "日時", default: null },
      { key: "memo", property: "メモ", type: "rich_text", label: "メモ", default: "" },
    ],
  },
  jobhunting: {
    titleProperty: "会社名",
    fields: [
      {
        key: "status",
        property: "ステータス",
        type: "status",
        label: "ステータス",
        default: "説明会",
        options: ["説明会", "履歴書", "最終", "1次", "2次", "落選", "内定"],
      },
      { key: "dueDate", property: "期日", type: "date", label: "期日", default: null },
      { key: "description", property: "説明", type: "rich_text", label: "説明", default: "" },
    ],
  },
  memo: {
    // このデータベースはタイトル用プロパティが「メモ登録日時」という名前だが型はtitle（自由記述用）。
    // 実データ上の命名の癖であり、こちらで作り直せないためそのまま使う。
    titleProperty: "メモ登録日時",
    fields: [{ key: "content", property: "メモ内容", type: "rich_text", label: "内容", default: "" }],
  },
};

// 全角数字を半角に変換する（日付・時刻の正規表現マッチのため）
function normalizeFullWidthDigits(text) {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// メッセージから日付・時刻を読み取り、Notionのdateプロパティ用ISO文字列と表示用文字列を返す
function extractDateTimeFromText(text) {
  const normalized = normalizeFullWidthDigits(text);
  const currentYear = new Date().getFullYear();
  let month;
  let day;

  const slashMatch = normalized.match(/(\d{1,2})[\/月](\d{1,2})日?/);
  if (slashMatch) {
    month = parseInt(slashMatch[1], 10);
    day = parseInt(slashMatch[2], 10);
  } else {
    const mmddMatch = normalized.match(/(\d{2})(\d{2})(?:で|に)?/);
    if (mmddMatch) {
      const mm = parseInt(mmddMatch[1], 10);
      const dd = parseInt(mmddMatch[2], 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        month = mm;
        day = dd;
      }
    }
  }

  if (month === undefined || day === undefined) return null;

  let hour;
  let minute = 0;
  const timeMatch = normalized.match(/(\d{1,2})[時:](\d{2})?/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  }

  const pad = (n) => String(n).padStart(2, "0");
  if (hour !== undefined) {
    return {
      iso: `${currentYear}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`,
      display: `${currentYear}/${pad(month)}/${pad(day)} ${pad(hour)}:${pad(minute)}`,
    };
  }
  return {
    iso: `${currentYear}-${pad(month)}-${pad(day)}`,
    display: `${currentYear}/${pad(month)}/${pad(day)}`,
  };
}

// select/status系のフィールドについて、選択肢に含まれる単語がメッセージ内にあるか探す
function extractOptionFromText(text, options) {
  return options.find((option) => text.includes(option)) || null;
}

// メッセージからタイトルと各フィールドの値を抽出する。読み取れない項目は既定値で自動補完する。
function extractFieldsFromMessage(topicId, rawText) {
  const schema = TOPIC_REGISTRATION_SCHEMAS[topicId];
  const topic = NOTION_TOPICS.find((t) => t.id === topicId);
  // 全角数字（３個、１４時など）も拾えるように、以降の処理はすべて正規化済みテキストに対して行う
  const text = normalizeFullWidthDigits(rawText);

  // 「未分類メモ」はタイトル自体が本文を兼ねるため、メモ注釈パターン（「メモは〜」等）の抽出・除去は行わない
  // （行うと、本文全体がメモ注釈として吸われてタイトルが空になってしまうため）
  const isMemoTopic = topicId === "memo";
  const quantityMatch = text.match(/(\d+)\s*(個|つ|本|パック|袋|枚|箱|kg|g)/);
  const memoMatch = isMemoTopic
    ? null
    : text.match(/メモ(?:は|:|：)\s*(.+?)(?:で登録|。|$)/) || text.match(/(.+?)というメモ/);
  const dateInfo = extractDateTimeFromText(text);

  const values = {};
  for (const field of schema.fields) {
    if (field.type === "number") {
      values[field.key] = quantityMatch ? parseInt(quantityMatch[1], 10) : field.default;
    } else if (field.type === "rich_text") {
      values[field.key] = memoMatch ? memoMatch[1].trim() : field.default;
    } else if (field.type === "date") {
      values[field.key] = dateInfo ? dateInfo.iso : field.default;
      // スケジュールは終了時刻が指定されないことが多いので、表示上は23:58までとして分かりやすくしておく
      values[`${field.key}Display`] = dateInfo
        ? topicId === "schedule"
          ? `${dateInfo.display}〜23:58`
          : dateInfo.display
        : null;
    } else if (field.type === "status" || field.type === "select") {
      values[field.key] = (field.options && extractOptionFromText(text, field.options)) || field.default;
    }
  }

  // タイトル抽出：既知のキーワード・登録の動詞・数量/日付/選択肢・項目ラベルに一致した部分を取り除いた残り
  let title = text;
  if (memoMatch) title = title.replace(memoMatch[0], "");
  if (quantityMatch) title = title.replace(quantityMatch[0], "");
  title = title
    .replace(/(\d{1,2})[\/月](\d{1,2})日?まで(に)?/, "")
    .replace(/(\d{1,2})[\/月](\d{1,2})日?/, "")
    .replace(/(\d{2})(\d{2})(?:で|に)?/, "")
    .replace(/(\d{1,2})[時:](\d{2})?(から|より)?/, "");

  for (const field of schema.fields) {
    // 項目のラベル語（「優先度」「ステータス」など）自体も取り除く
    title = title.replaceAll(field.label, "");
    if (field.options) {
      for (const option of field.options) {
        title = title.replaceAll(option, "");
      }
    }
  }
  for (const t of NOTION_TOPICS) {
    for (const keyword of t.keywords) {
      title = title.replaceAll(keyword, "");
    }
  }
  for (const verb of REGISTER_VERBS) {
    title = title.replaceAll(verb, "");
  }
  title = title
    .replace(/notion/gi, "")
    .replaceAll("リスト", "")
    .replace(/(まで|して|ください|お願い|に|へ|を|で|、|。|\s)+/g, " ")
    .trim();

  // 未分類メモは、整形後の本文をそのままタイトル・rich_text両方の値として使う
  if (isMemoTopic) {
    values.content = title;
  }

  return { topic, schema, title, values };
}

function summarizeFields(schema, values) {
  return schema.fields
    .filter((field) => values[field.key] !== null && values[field.key] !== undefined && values[field.key] !== "")
    .map((field) => {
      const displayValue = field.type === "date" ? values[`${field.key}Display`] : values[field.key];
      return `${field.label}: ${displayValue}`;
    });
}

// 「登録して」と言われた直後にいきなり書き込まず、まず内容を提示して確認を取るためのプレビューを作る。
// 実際の書き込みは、ユーザーが確認した後に commitRegistration で行う。
export function buildRegistrationPreview(topicId, text) {
  const schema = TOPIC_REGISTRATION_SCHEMAS[topicId];
  if (!schema) {
    return { item: null, message: "このトピックへの登録にはまだ対応していません。" };
  }

  const { topic, title, values } = extractFieldsFromMessage(topicId, text);
  if (!title) {
    return {
      item: null,
      message: `何を${topic.label}に登録すればいいか読み取れませんでした。名前を教えてください。`,
    };
  }

  const summaryParts = summarizeFields(schema, values);
  const summary = summaryParts.length > 0 ? `（${summaryParts.join("、")}）` : "";

  return {
    item: { topicId, title, values },
    message: `${topic.label}に「${title}」を登録するね${summary}。これで合ってる？`,
  };
}

// 確認が取れた後に、実際にNotionへ1件書き込む
export async function commitRegistration(item) {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    return "NOTION_API_KEYが設定されていないため、登録できませんでした。";
  }

  const schema = TOPIC_REGISTRATION_SCHEMAS[item?.topicId];
  const topic = NOTION_TOPICS.find((t) => t.id === item?.topicId);
  const title = typeof item?.title === "string" ? item.title.trim() : "";
  const values = item?.values && typeof item.values === "object" ? item.values : {};

  if (!schema || !topic || !title) {
    return "登録内容が読み取れませんでした。もう一度お願いします。";
  }

  const properties = {
    [schema.titleProperty]: { title: [{ text: { content: title } }] },
  };

  // 「未分類メモ」はタイトル自体が本文を兼ねるため、rich_text側にも同じ内容を入れておく
  if (item.topicId === "memo") {
    properties["メモ内容"] = { rich_text: [{ text: { content: title } }] };
  }

  for (const field of schema.fields) {
    const value = values[field.key];
    if (value === null || value === undefined || value === "") continue;

    if (field.type === "number") {
      properties[field.property] = { number: value };
    } else if (field.type === "rich_text") {
      properties[field.property] = { rich_text: [{ text: { content: String(value) } }] };
    } else if (field.type === "date") {
      // スケジュールは終了時刻が指定されないことが多いので、未指定なら同日23:58を終了時刻として登録する
      if (item.topicId === "schedule") {
        const datePart = String(value).slice(0, 10);
        properties[field.property] = { date: { start: value, end: `${datePart}T23:58:00+09:00` } };
      } else {
        properties[field.property] = { date: { start: value } };
      }
    } else if (field.type === "status") {
      properties[field.property] = { status: { name: value } };
    } else if (field.type === "select") {
      properties[field.property] = { select: { name: value } };
    }
  }

  try {
    await createDatabasePage(notionApiKey, topic.databaseId, properties);
    const summaryParts = summarizeFields(schema, values);
    const summary = summaryParts.length > 0 ? `（${summaryParts.join("、")}）` : "";
    return `${topic.label}に「${title}」を登録しといたよ${summary}。他にも何かあれば言ってね！`;
  } catch (error) {
    console.error("Notion登録エラー:", error.message);
    return `${topic.label}への登録に失敗しました。もう一度試してみてください。`;
  }
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
  "- ただし「買い物リストがほしい」のように一覧そのものを求められたときは例外です。Markdownテーブル（|で区切る表）や「- 」のようなハイフンの箇条書きは絶対に使わないでください。必ず全角の中点記号「・」を行頭に使い、「・商品名」の形式で名前だけを示してください（ハイフンは使用禁止、必ず「・」を使うこと）。アイテムを1つずつ改行し、1行につき1アイテムだけを書いてください（複数のアイテムを同じ行に並べたり「・」で連結したりしないこと）。数量やメモなどの詳細は、特に聞かれない限り省略してください。箇条書きを出す場合も、その前後に短い一言コメントは添えてください。",
  "- ただし「スケジュール」「予定」「日時」に関するデータ（日時・期日プロパティを持つもの）は例外中の例外です。名前だけの省略はせず、一覧形式であっても必ず「・予定名 日付 時刻」のように日時（期日）を毎回セットで出力してください。日時が無いと何のための予定か分からず、スケジュール管理として意味がないためです。",
  "- 進捗管理のデータについて聞かれたときは、ステータスが「完了」のタスクは一覧から除外してください。表示するタスクは「本日」の日付を基準に、期日が本日から近い順に並べてください（過去日・未来日を問わず、本日との差が小さいものを優先。単純に古い期日から並べるのではありません）。期日が無いものは最後にしてください。",
  "- 一覧を箇条書きで示すときは、原則として上から5件までにしてください。渡されたデータが5件を超える場合は、箇条書きの後に「他にもN件あります。詳しくはNotionを確認してね」のように残り件数を一言添えてください（Nは実際の残り件数）。ただしユーザーが「全部」「すべて」「全件」のように明示的に全件表示を求めている場合は、件数制限をせず全件を表示してください。",
  "- 渡されたNotionデータに無関係な一般論やアドバイスを付け加えないでください。渡されたデータの範囲内だけで答えてください。",
  "",
  "一覧表示の見本（この形式を真似すること）:",
  "まずは上位5件を抜粋してお届けしますね。",
  "",
  "・猫",
  "・【テスト】ドリップコーヒーパック",
  "・【テスト】米",
  "・【テスト】ヨーグルト",
  "・【テスト】洗剤",
  "",
  "他にも17件あります。詳しくはNotionを確認してね。",
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
    if (res.status === 429) {
      throw new Error("今ちょっとお話しすぎて混み合ってるみたい。少し時間を置いてからもう一度話しかけてね。");
    }
    const responseText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${responseText}`);
  }

  const data = await res.json().catch(() => null);
  return typeof data?.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content.trim()
    : "";
}

async function buildNotionPrompt(question, forcedTopics) {
  const questionText = typeof question === "string" ? question.trim() : "";
  if (!questionText) {
    throw new Error("質問文が必要です");
  }

  // forcedTopics が指定されていれば話題判定をスキップしてそれを使う
  // （曖昧なときにユーザーがボタンで選んだトピックをそのまま使う場合など）
  const matchedTopics = forcedTopics && forcedTopics.length > 0 ? forcedTopics : detectNotionTopics(questionText);
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

export async function generateTextFromNotionData(question, forcedTopics) {
  const promptText = await buildNotionPrompt(question, forcedTopics);
  return generateText(promptText);
}
