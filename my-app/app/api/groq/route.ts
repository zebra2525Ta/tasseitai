import { NextResponse } from "next/server";
import { generateText } from "./groq";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt が必要です" }, { status: 400 });
    }

    const content = await generateText(prompt);
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
