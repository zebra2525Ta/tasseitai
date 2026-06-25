import { NextResponse } from "next/server";
import { generateText, generateTextFromNotionData } from "./groq.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const databaseItems = Array.isArray(body?.databaseItems) ? body.databaseItems : undefined;

    let content;

    if (question) {
      content = await generateTextFromNotionData(question, databaseItems);
    } else if (prompt) {
      content = await generateText(prompt);
    } else {
      return NextResponse.json({ error: "prompt または question が必要です" }, { status: 400 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
