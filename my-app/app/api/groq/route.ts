import { NextResponse } from "next/server";
import {
  generateText,
  generateTextFromNotionData,
  detectNotionTopics,
  hasRegisterIntent,
  hasGeneralNotionIntent,
  buildShoppingRegistrationPreview,
  commitShoppingRegistration,
  NOTION_TOPICS,
} from "./groq.js";

export const runtime = "nodejs";

type Topic = { id: string; label: string };

function topicChoices() {
  return NOTION_TOPICS.map((topic: Topic) => ({ id: topic.id, label: topic.label }));
}

function handleRegisterAtTopic(topic: Topic, originalMessage: string) {
  if (topic.id === "shopping") {
    const preview = buildShoppingRegistrationPreview(originalMessage);
    return { content: preview.message, pendingItem: preview.item };
  }
  return {
    content: `ごめん、今は買い物リストへの登録だけ対応しているんだ。${topic.label}への登録は、お手数だけどNotionから直接お願いします！`,
  };
}

async function handleReadForTopics(topics: Topic[], message: string) {
  const content = await generateTextFromNotionData(message, topics);
  return { content };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const confirmRegistration = body?.confirmRegistration;
    const forcedTopicId = typeof body?.topicId === "string" ? body.topicId : "";
    const originalMessage = typeof body?.originalMessage === "string" ? body.originalMessage.trim() : "";

    // 登録内容の確認が取れている場合は、そのまま書き込みを実行する
    if (confirmRegistration && typeof confirmRegistration === "object") {
      const content = await commitShoppingRegistration(confirmRegistration);
      return NextResponse.json({ content });
    }

    // 曖昧だったため選択肢から選んでもらった後の再リクエスト
    if (forcedTopicId && originalMessage) {
      const topic = NOTION_TOPICS.find((t: Topic) => t.id === forcedTopicId);
      if (!topic) {
        return NextResponse.json({ error: "不明なトピックです" }, { status: 400 });
      }
      const result = hasRegisterIntent(originalMessage)
        ? handleRegisterAtTopic(topic, originalMessage)
        : await handleReadForTopics([topic], originalMessage);
      return NextResponse.json(result);
    }

    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    const matchedTopics = detectNotionTopics(message);
    const isRegister = hasRegisterIntent(message);

    // トピックが1つに絞れない（読み取りは0件、登録依頼は0件または2件以上）場合は、
    // 勝手に推測せず選択肢を出してユーザーに選んでもらう
    const isAmbiguous = isRegister ? matchedTopics.length !== 1 : matchedTopics.length === 0;

    if (isAmbiguous) {
      if (isRegister || hasGeneralNotionIntent(message)) {
        return NextResponse.json({
          content: isRegister
            ? "どこに登録すればいいか迷っちゃった。下から選んでね。"
            : "どの情報について知りたいか迷っちゃった。下から選んでね。",
          topicChoices: topicChoices(),
          originalMessage: message,
        });
      }
      // Notionに関係なさそうな曖昧なメッセージは通常の会話として扱う
      const content = await generateText(message);
      return NextResponse.json({ content });
    }

    const result = isRegister
      ? handleRegisterAtTopic(matchedTopics[0], message)
      : await handleReadForTopics(matchedTopics, message);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
