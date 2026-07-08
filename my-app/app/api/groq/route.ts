import { NextResponse } from "next/server";
import { generateText, generateTextFromNotionData, shouldUseNotionContext } from "./groq.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    // Notionを参照すべきメッセージかどうかはサーバー側で判定する
    const content = shouldUseNotionContext(message)
      ? await generateTextFromNotionData(message)
      : await generateText(message);

    return NextResponse.json({ content });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
