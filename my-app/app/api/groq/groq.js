// 使い方：呼び出したいファイルで、
// import { generateText } from "./groq.js";　を追加してください。
// その後、generateText関数を呼び出すだけです。
//
// 例：test.js での呼び出し例があります。参考にしてください。

import { queryNotionDatabase, searchNotionPages, collectNotionPageInfo, createDatabasePage, getDatabaseSchema } from "../notion/notion.js";

// 実際のデータベースのプロパティ一覧から、type: "title" のプロパティ名を探す
// （個人ワークスペースではタイトル用プロパティの名前が共有ワークスペースと違うことがあるため）
function findTitlePropertyName(actualProperties, fallback) {
  const found = Object.entries(actualProperties || {}).find(([, def]) => def?.type === "title")?.[0];
  return found || fallback;
}

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
export const TOPIC_REGISTRATION_SCHEMAS = {
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

// 現在時刻をJST（日本時間）の "YYYY/MM/DD HH:mm" 形式で返す。
// サーバーの実行環境（Vercel等）はUTCで動くことが多いため、new Date()のgetHours()等をそのまま使うと
// 日本時間からずれてしまう。UTC時刻に9時間分を加算してからUTCゲッターで読むことで、
// サーバーのタイムゾーン設定に関わらず常に日本時間になるようにする。
function formatNowJST() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
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

// 「0820～0824」「8/20〜8/24」のような日付の範囲を読み取る。範囲が無ければnullを返す
function extractDateRangeFromText(text) {
  const normalized = normalizeFullWidthDigits(text);

  // 8/20〜8/24 や 8月20日〜8月24日 のような表記
  let match = normalized.match(/(\d{1,2})[\/月](\d{1,2})日?\s*[~〜～\-−]\s*(?:(\d{1,2})[\/月])?(\d{1,2})日?/);
  if (match) {
    const startMonth = parseInt(match[1], 10);
    const startDay = parseInt(match[2], 10);
    const endMonth = match[3] ? parseInt(match[3], 10) : startMonth;
    const endDay = parseInt(match[4], 10);
    return { startMonth, startDay, endMonth, endDay, matchedText: match[0] };
  }

  // 0820〜0824 のような MMDD〜MMDD
  match = normalized.match(/(\d{2})(\d{2})\s*[~〜～\-−]\s*(\d{2})(\d{2})/);
  if (match) {
    const startMonth = parseInt(match[1], 10);
    const startDay = parseInt(match[2], 10);
    const endMonth = parseInt(match[3], 10);
    const endDay = parseInt(match[4], 10);
    if (
      startMonth >= 1 && startMonth <= 12 && startDay >= 1 && startDay <= 31 &&
      endMonth >= 1 && endMonth <= 12 && endDay >= 1 && endDay <= 31
    ) {
      return { startMonth, startDay, endMonth, endDay, matchedText: match[0] };
    }
  }

  return null;
}

// 「0807、0808」「8/7,8/10」のような、読点・カンマ・中点区切りの日付の並びを読み取る（2つ以上あれば有効）
function extractDateListFromText(text) {
  const normalized = normalizeFullWidthDigits(text);
  const dateToken = "(?:\\d{1,2}[\\/月]\\d{1,2}日?|\\d{4})";
  const chunkPattern = new RegExp(`${dateToken}(?:\\s*[、,・]\\s*${dateToken}){1,}`);
  const chunkMatch = normalized.match(chunkPattern);
  if (!chunkMatch) return null;

  const chunkText = chunkMatch[0];
  const currentYear = new Date().getFullYear();
  const dates = [];

  for (const token of chunkText.split(/[、,・]/)) {
    const trimmed = token.trim();
    let month;
    let day;

    let m = trimmed.match(/^(\d{1,2})[\/月](\d{1,2})日?$/);
    if (m) {
      month = parseInt(m[1], 10);
      day = parseInt(m[2], 10);
    } else {
      m = trimmed.match(/^(\d{2})(\d{2})$/);
      if (m) {
        const mm = parseInt(m[1], 10);
        const dd = parseInt(m[2], 10);
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          month = mm;
          day = dd;
        }
      }
    }

    if (month === undefined || day === undefined) continue;
    dates.push(`${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  if (dates.length < 2) return null;
  return { dates, matchedText: chunkText };
}

// 範囲の開始日〜終了日までの日付（YYYY-MM-DD）を1日ずつ列挙する
function buildDateRangeList(range) {
  const currentYear = new Date().getFullYear();
  const start = new Date(currentYear, range.startMonth - 1, range.startDay);
  const end = new Date(currentYear, range.endMonth - 1, range.endDay);

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const mo = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${mo}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// タイトル抽出（範囲登録用の簡易版）：日付範囲・登録動詞・トピックキーワードを取り除いた残り
function extractTitleExcluding(text, matchedText) {
  let title = matchedText ? text.replace(matchedText, "") : text;
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
  return title;
}

// メッセージからタイトルと各フィールドの値を抽出する。読み取れない項目は既定値で自動補完する。
function extractFieldsFromMessage(topicId, rawText) {
  const schema = TOPIC_REGISTRATION_SCHEMAS[topicId];
  const topic = NOTION_TOPICS.find((t) => t.id === topicId);
  // 全角数字（３個、１４時など）も拾えるように、以降の処理はすべて正規化済みテキストに対して行う
  const text = normalizeFullWidthDigits(rawText);

  // 「未分類メモ」は、送ったメッセージをそのまま本文として貼り付けたいので、
  // 数量・日付・キーワード除去などの整形処理を一切かけず、生のテキストをそのまま使う。
  // タイトル（メモ登録日時）は本文からではなく、送信時刻から別途組み立てる。
  if (topicId === "memo") {
    const content = rawText.trim();
    return {
      topic,
      schema,
      title: content,
      values: { content, registeredAt: formatNowJST() },
    };
  }

  const quantityMatch = text.match(/(\d+)\s*(個|つ|本|パック|袋|枚|箱|kg|g)/);
  const memoMatch =
    text.match(/メモ(?:は|:|：)\s*(.+?)(?:で登録|。|$)/) || text.match(/(.+?)というメモ/);
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

// 固定の5トピックに当てはまらない、ユーザー独自のデータベース向けの登録プレビュー（タイトルのみの簡易版）
export function buildGenericRegistrationPreview(databaseId, databaseLabel, text) {
  const title = extractTitleExcluding(normalizeFullWidthDigits(text), null);
  if (!title) {
    return {
      item: null,
      message: `何を「${databaseLabel}」に登録すればいいか読み取れませんでした。名前を教えてください。`,
    };
  }
  return {
    item: { databaseId, title },
    message: `「${databaseLabel}」に「${title}」を登録するね。これで合ってる？`,
  };
}

// 「登録して」と言われた直後にいきなり書き込まず、まず内容を提示して確認を取るためのプレビューを作る。
// 実際の書き込みは、ユーザーが確認した後に commitRegistration で行う。
export function buildRegistrationPreview(topicId, text) {
  const schema = TOPIC_REGISTRATION_SCHEMAS[topicId];
  if (!schema) {
    return { item: null, message: "このトピックへの登録にはまだ対応していません。" };
  }

  // スケジュールは「0820〜0824」のような範囲指定や「0807、0808」のような複数日列挙に対応する。
  // 該当すれば、各日を0:00〜23:58の終日予定として1件ずつまとめて登録する。
  if (topicId === "schedule") {
    const topic = NOTION_TOPICS.find((t) => t.id === topicId);

    const list = extractDateListFromText(text);
    const range = list ? null : extractDateRangeFromText(text);
    const matchedText = list?.matchedText || range?.matchedText;
    const dates = list ? list.dates : range ? buildDateRangeList(range) : null;

    if (dates) {
      const title = extractTitleExcluding(normalizeFullWidthDigits(text), matchedText);
      if (!title) {
        return {
          item: null,
          message: `何を${topic.label}に登録すればいいか読み取れませんでした。名前を教えてください。`,
        };
      }

      return {
        item: { topicId, title, multiDates: dates },
        message: `スケジュールに「${title}」を${dates.join("、")}の${dates.length}日、各日0:00〜23:58で登録するね。これで合ってる？`,
      };
    }
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

// 複数日の範囲（multiDates）が指定されている場合、各日を0:00〜23:58の終日予定として1件ずつ登録する
async function commitMultiDayRegistration(notionApiKey, title, dates, databaseId) {
  // 個人ワークスペースではプロパティ名・構成が違うことがあるので、実際のスキーマを見てから書き込む
  const actualSchema = await getDatabaseSchema(notionApiKey, databaseId);
  const actualProperties = actualSchema?.properties || {};
  const titleProperty = findTitlePropertyName(actualProperties, "予定");
  const hasDateProperty = actualProperties?.["日時"]?.type === "date";

  for (const date of dates) {
    const properties = {
      [titleProperty]: { title: [{ text: { content: title } }] },
    };
    if (hasDateProperty) {
      properties["日時"] = { date: { start: `${date}T00:00:00+09:00`, end: `${date}T23:58:00+09:00` } };
    }
    await createDatabasePage(notionApiKey, databaseId, properties);
  }

  return `スケジュールに「${title}」を${dates.join("、")}の${dates.length}日、各日0:00〜23:58で登録しといたよ。予定は事前に準備しておくと安心だね！`;
}

// 固定の5トピックに当てはまらない、ユーザー独自のデータベースへの登録。
// スキーマが分からないため、タイトルだけを書き込む簡易版（詳細な項目はNotion側で追記してもらう想定）
async function commitGenericRegistration(databaseId, title, notionApiKey) {
  try {
    const actualSchema = await getDatabaseSchema(notionApiKey, databaseId);
    const actualProperties = actualSchema?.properties || {};
    const titleProperty = findTitlePropertyName(actualProperties, "名前");

    await createDatabasePage(notionApiKey, databaseId, {
      [titleProperty]: { title: [{ text: { content: title } }] },
    });
    return `登録しといたよ。他にも何かあれば言ってね！`;
  } catch (error) {
    console.error("Notion登録エラー:", error.message);
    return "登録先のデータベースが見つからず、登録できませんでした。";
  }
}

// 確認が取れた後に、実際にNotionへ1件書き込む
// databaseMap: トピックID -> 実際に使うデータベースID（ユーザーが個人ワークスペース用に上書きしている場合はそちら）
export async function commitRegistration(item, notionApiKey, databaseMap = {}) {
  if (!notionApiKey) {
    return "Notionと連携されていないため、登録できませんでした。";
  }

  // 固定5トピック以外の、ユーザー独自データベースへの登録
  if (item?.databaseId) {
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!title) {
      return "登録内容が読み取れませんでした。もう一度お願いします。";
    }
    return commitGenericRegistration(item.databaseId, title, notionApiKey);
  }

  if (Array.isArray(item?.multiDates) && item.multiDates.length > 0) {
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!title) {
      return "登録内容が読み取れませんでした。もう一度お願いします。";
    }
    try {
      const scheduleTopic = NOTION_TOPICS.find((t) => t.id === "schedule");
      const databaseId = databaseMap.schedule || scheduleTopic.databaseId;
      return await commitMultiDayRegistration(notionApiKey, title, item.multiDates, databaseId);
    } catch (error) {
      console.error("Notion登録エラー:", error.message);
      return "スケジュール用のデータベースが見つからず、登録できませんでした。Notion側でデータベース名を確認するか、設定画面から直接データベースIDを指定してください。";
    }
  }

  const schema = TOPIC_REGISTRATION_SCHEMAS[item?.topicId];
  const topic = NOTION_TOPICS.find((t) => t.id === item?.topicId);
  const title = typeof item?.title === "string" ? item.title.trim() : "";
  const values = item?.values && typeof item.values === "object" ? item.values : {};

  if (!schema || !topic || !title) {
    return "登録内容が読み取れませんでした。もう一度お願いします。";
  }

  const databaseId = databaseMap[item.topicId] || topic.databaseId;

  try {
    // 個人ワークスペースではプロパティの名前・型が共有ワークスペースと完全には一致しないことがあるため、
    // 実際のデータベースのプロパティ構成を見て、存在して型も一致するものだけを書き込む
    const actualSchema = await getDatabaseSchema(notionApiKey, databaseId);
    const actualProperties = actualSchema?.properties || {};
    const titleProperty = findTitlePropertyName(actualProperties, schema.titleProperty);

    // 「未分類メモ」は、タイトル（メモ登録日時）にはチャットを送った時刻を、
    // 本文にはメッセージの文字列をそのまま入れる（他のトピックはタイトル欄に登録内容の名前を入れる）
    const isMemo = item.topicId === "memo";
    const titleValue = isMemo && typeof values.registeredAt === "string" && values.registeredAt
      ? values.registeredAt
      : title;

    const properties = {
      [titleProperty]: { title: [{ text: { content: titleValue } }] },
    };

    if (isMemo) {
      const memoBodyProperty = Object.entries(actualProperties).find(
        ([name, def]) => name !== titleProperty && def?.type === "rich_text"
      )?.[0];
      if (memoBodyProperty) {
        properties[memoBodyProperty] = { rich_text: [{ text: { content: title } }] };
      }
    }

    for (const field of schema.fields) {
      const value = values[field.key];
      if (value === null || value === undefined || value === "") continue;

      // 実際のデータベースに同名・同型のプロパティが無ければスキップする（個人ワークスペースの構成差を許容する）
      const actualDef = actualProperties[field.property];
      if (!actualDef || actualDef.type !== field.type) continue;

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

    await createDatabasePage(notionApiKey, databaseId, properties);
    const summaryParts = summarizeFields(schema, values);
    const summary = summaryParts.length > 0 ? `（${summaryParts.join("、")}）` : "";
    return `${topic.label}に「${title}」を登録しといたよ${summary}。他にも何かあれば言ってね！`;
  } catch (error) {
    console.error("Notion登録エラー:", error.message);
    return `${topic.label}用のデータベースが見つからず、登録できませんでした。Notion側でデータベース名を確認するか、設定画面から直接データベースIDを指定してください。`;
  }
}

// 特定のデータベース1つだけを取得する
async function fetchTopicData(topic, notionApiKey, databaseId) {
  if (!notionApiKey) {
    console.error("Notionデータ取得エラー: Notionと連携されていません");
    return [];
  }

  try {
    const pages = await queryNotionDatabase(notionApiKey, databaseId || topic.databaseId, 50, 2);
    return pages.map((page) => collectNotionPageInfo(page));
  } catch (error) {
    console.error(`Notionデータ取得エラー(${topic.label}):`, error.message);
    return [];
  }
}

// 話題が特定できない場合のフォールバック：ワークスペース全体から取得する
async function fetchWorkspaceData(notionApiKey) {
  if (!notionApiKey) {
    console.error("Notionデータ取得エラー: Notionと連携されていません");
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
  "- 進捗管理のデータについて聞かれたときは、ステータスが「完了」のタスクは一覧から除外してください。それ以外の未完了タスクは、期日をどれだけ過ぎていても絶対に除外・省略せず全件表示してください（下記の『上位5件まで』という件数制限は進捗管理には適用しません。期日超過の未完了タスクを見せないのはタスク管理として致命的なため）。表示順は「本日」の日付を基準に、期日が本日から近い順に並べてください（過去日・未来日を問わず、本日との差が小さいものを優先。単純に古い期日から並べるのではありません）。期日が無いものは最後にしてください。",
  "- 進捗管理以外のデータ（就活・スケジュールなど、日時・期日プロパティを持つもの）を一覧表示するときは、現在の日時に近いもの（直近の予定・締切）を優先して並べてください。",
  "- 一覧を箇条書きで示すときは、原則として上から5件までにしてください（進捗管理の未完了タスクは例外で、上記の通り件数制限なしで全件表示します）。渡されたデータが5件を超える場合は、箇条書きの後に「他にもN件あります。詳しくはNotionを確認してね」のように残り件数を一言添えてください（Nは実際の残り件数）。ただしユーザーが「全部」「すべて」「全件」のように明示的に全件表示を求めている場合は、件数制限をせず全件を表示してください。",
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
        // gpt-oss系は推論モデルのため、reasoning_effortを下げて回答本文用のトークンを確保する。
        // 指定しないとGroq側のデフォルト（高め）になり、複雑な指示（期日ソート等）で
        // 推論だけでトークンを使い切りcontentが空文字で返ってくることがある。
        reasoning_effort: "low",
        max_completion_tokens: 2048,
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
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("GROQ応答が空文字でした。finish_reason:", data?.choices?.[0]?.finish_reason);
    return "";
  }
  return content.trim();
}

async function buildNotionPrompt(question, forcedTopics, notionApiKey, databaseMap = {}) {
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
        const results = await fetchTopicData(topic, notionApiKey, databaseMap[topic.id]);
        return formatNotionResultsForPrompt(results, topic.label);
      })
    );
    propertiesText = sections.filter(Boolean).join("\n\n");
  } else {
    // 話題を特定できない場合はワークスペース全体から探す
    const results = await fetchWorkspaceData(notionApiKey);
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

export async function generateTextFromNotionData(question, forcedTopics, notionApiKey, databaseMap = {}) {
  const promptText = await buildNotionPrompt(question, forcedTopics, notionApiKey, databaseMap);
  return generateText(promptText);
}

// 固定の5トピックに当てはまらない、ユーザー独自のデータベースを指定して読む
export async function generateTextFromArbitraryDatabase(question, databaseId, databaseLabel, notionApiKey) {
  const questionText = typeof question === "string" ? question.trim() : "";
  if (!questionText) {
    throw new Error("質問文が必要です");
  }

  const pages = await queryNotionDatabase(notionApiKey, databaseId, 50, 2);
  const results = pages.map((page) => collectNotionPageInfo(page));
  let propertiesText = formatNotionResultsForPrompt(results, databaseLabel);

  if (propertiesText.length > NOTION_PROMPT_MAX_CHARS) {
    propertiesText = propertiesText.slice(0, NOTION_PROMPT_MAX_CHARS) + "\n...(以下省略)";
  }

  const promptText = [
    "以下は Notion から取得した情報です。",
    "これらのデータをもとに、質問に回答してください。",
    "",
    propertiesText || "(該当するNotionデータが見つかりませんでした)",
    "",
    `質問: ${questionText}`,
  ].join("\n");

  return generateText(promptText);
}
