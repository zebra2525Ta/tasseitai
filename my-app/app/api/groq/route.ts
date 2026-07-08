import { NextResponse } from "next/server";
import {
  generateText,
  generateTextFromNotionData,
  shouldUseNotionContext,
  isShoppingRegisterRequest,
  registerShoppingItem,
} from "./groq.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    let content: string;
    if (isShoppingRegisterRequest(message)) {
      // 買い物リストへの登録依頼は、Notionへの書き込みを行う専用パスで処理する
      content = await registerShoppingItem(message);
    } else if (shouldUseNotionContext(message)) {
      content = await generateTextFromNotionData(message);
    } else {
      content = await generateText(message);
    }

    return NextResponse.json({ content });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
