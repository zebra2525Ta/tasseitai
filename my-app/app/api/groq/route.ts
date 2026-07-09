import { NextResponse } from "next/server";
import {
  generateText,
  generateTextFromNotionData,
  detectNotionTopics,
  hasRegisterIntent,
  hasGeneralNotionIntent,
  buildRegistrationPreview,
  commitRegistration,
  NOTION_TOPICS,
} from "./groq.js";
import { resolveNotionSession } from "@/lib/notionAuth";
import { getUserDatabaseMap } from "@/lib/notionDatabaseMap";

export const runtime = "nodejs";

type Topic = { id: string; label: string };

function topicChoices(unresolved: string[] = []) {
  return NOTION_TOPICS.filter((topic: Topic) => !unresolved.includes(topic.id)).map((topic: Topic) => ({
    id: topic.id,
    label: topic.label,
  }));
}

function handleRegisterAtTopic(topic: Topic, originalMessage: string) {
  const preview = buildRegistrationPreview(topic.id, originalMessage);
  return { content: preview.message, pendingItem: preview.item };
}

async function handleReadForTopics(
  topics: Topic[],
  message: string,
  notionApiKey: string,
  databaseMap: Record<string, string>
) {
  const content = await generateTextFromNotionData(message, topics, notionApiKey, databaseMap);
  return { content };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const confirmRegistration = body?.confirmRegistration;
    const forcedTopicId = typeof body?.topicId === "string" ? body.topicId : "";
    const originalMessage = typeof body?.originalMessage === "string" ? body.originalMessage.trim() : "";

    const session = await resolveNotionSession();
    const notionApiKey = session?.accessToken ?? null;
    const { databases: databaseMap, unresolved } = session
      ? await getUserDatabaseMap(session.userId, session.accessToken)
      : { databases: {} as Record<string, string>, unresolved: [] as string[] };

    // 登録内容の確認が取れている場合は、そのまま書き込みを実行する
    if (confirmRegistration && typeof confirmRegistration === "object") {
      if (!notionApiKey) {
        return NextResponse.json({ error: "Notionと連携されていません" }, { status: 401 });
      }
      const targetTopicId =
        Array.isArray(confirmRegistration.multiDates) && confirmRegistration.multiDates.length > 0
          ? "schedule"
          : confirmRegistration.topicId;
      if (targetTopicId && unresolved.includes(targetTopicId)) {
        return NextResponse.json({
          content:
            "登録先のデータベースが見つからなかったため、登録できませんでした。Notion側でデータベース名を確認するか、設定画面から直接データベースIDを指定してください。",
        });
      }
      const content = await commitRegistration(confirmRegistration, notionApiKey, databaseMap);
      return NextResponse.json({ content });
    }

    // 曖昧だったため選択肢から選んでもらった後の再リクエスト
    if (forcedTopicId && originalMessage) {
      const topic = NOTION_TOPICS.find((t: Topic) => t.id === forcedTopicId);
      if (!topic) {
        return NextResponse.json({ error: "不明なトピックです" }, { status: 400 });
      }
      if (hasRegisterIntent(originalMessage)) {
        return NextResponse.json(handleRegisterAtTopic(topic, originalMessage));
      }
      if (!notionApiKey) {
        return NextResponse.json({ error: "Notionと連携されていません" }, { status: 401 });
      }
      const result = await handleReadForTopics([topic], originalMessage, notionApiKey, databaseMap);
      return NextResponse.json(result);
    }

    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    const matchedTopics = detectNotionTopics(message);
    const isRegister = hasRegisterIntent(message);

    // トピックが1つに絞れない（0件、または2件以上に同時ヒット）場合は、
    // 勝手に複数のデータベースを混ぜたりせず、選択肢を出してユーザーに1つ選んでもらう
    const isAmbiguous = matchedTopics.length !== 1;

    if (isAmbiguous) {
      // 2件以上のトピックに同時ヒットした場合も、Notionを見る意図があるのは明らかなので選択肢を出す
      if (isRegister || hasGeneralNotionIntent(message) || matchedTopics.length > 0) {
        const choices = topicChoices(unresolved);
        if (choices.length === 0) {
          return NextResponse.json({
            content:
              "利用できるNotionデータベースが見つかりませんでした。Notion側でデータベースを連携しているか確認してください。",
          });
        }
        return NextResponse.json({
          content: isRegister
            ? "どこに登録すればいいか迷っちゃった。下から選んでね。"
            : "どの情報について知りたいか迷っちゃった。下から選んでね。",
          topicChoices: choices,
          originalMessage: message,
        });
      }
      // Notionに関係なさそうな曖昧なメッセージは通常の会話として扱う
      const content = await generateText(message);
      return NextResponse.json({ content });
    }

    if (isRegister) {
      return NextResponse.json(handleRegisterAtTopic(matchedTopics[0], message));
    }
    if (!notionApiKey) {
      return NextResponse.json({ error: "Notionと連携されていません" }, { status: 401 });
    }
    const result = await handleReadForTopics(matchedTopics, message, notionApiKey, databaseMap);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
