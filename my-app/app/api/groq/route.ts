import { NextResponse } from "next/server";
import {
  generateText,
  generateTextFromNotionData,
  shouldUseNotionContext,
  isShoppingRegisterRequest,
  buildShoppingRegistrationPreview,
  commitShoppingRegistration,
} from "./groq.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const confirmRegistration = body?.confirmRegistration;

    // ユーザーが登録内容を確認済みの場合は、ここで実際にNotionへ書き込む
    if (confirmRegistration && typeof confirmRegistration === "object") {
      const content = await commitShoppingRegistration(confirmRegistration);
      return NextResponse.json({ content });
    }

    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    if (isShoppingRegisterRequest(message)) {
      // 即座には書き込まず、内容を提示して確認を取る
      const preview = buildShoppingRegistrationPreview(message);
      return NextResponse.json({ content: preview.message, pendingItem: preview.item });
    }

    const content = shouldUseNotionContext(message)
      ? await generateTextFromNotionData(message)
      : await generateText(message);

    return NextResponse.json({ content });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
