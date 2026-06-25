import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const category =
    searchParams.get("category") || "general";

  const res = await fetch(
    `https://gnews.io/api/v4/top-headlines?category=${category}&lang=ja&country=jp&max=2&apikey=${process.env.GNEWS_API_KEY}`
  );

  const data = await res.json();

  return NextResponse.json(data);
}