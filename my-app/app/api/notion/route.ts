import { NextResponse } from "next/server";
import {
  collectNotionPageInfo,
  queryNotionDatabase,
  searchNotionPages,
  filterNotionPagesByQuery,
} from "./notion";

const defaultPageSize = 50;
const defaultMaxPages = 3;

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, Math.floor(numberValue)) : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : process.env.NOTION_API_KEY;
    const databaseId = typeof body.databaseId === "string" ? body.databaseId.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const searchType = body.searchType === "search" ? "search" : "database";
    const filterType = body.filterType === "page" || body.filterType === "database" ? body.filterType : undefined;
    const pageSize = normalizeNumber(body.pageSize, defaultPageSize);
    const maxPages = normalizeNumber(body.maxPages, defaultMaxPages);
    const filter = body.filter && typeof body.filter === "object" ? (body.filter as any) : undefined;
    const sorts = Array.isArray(body.sorts) ? (body.sorts as any) : undefined;

    if (!apiKey) {
      return NextResponse.json({ error: "apiKey が必要です" }, { status: 400 });
    }

    if (searchType === "database" && !databaseId) {
      return NextResponse.json({ error: "databaseId が必要です" }, { status: 400 });
    }

    let pages: any[] = [];
    let source = "database";

    if (searchType === "search") {
      pages = await searchNotionPages(apiKey, query, pageSize, maxPages, filterType);
      source = "search";
    } else {
      pages = await queryNotionDatabase(apiKey, databaseId, pageSize, maxPages, filter, sorts);
      if (query) {
        pages = filterNotionPagesByQuery(pages, query);
      }
      source = "database";
    }

    const results = pages.map((page) => collectNotionPageInfo(page));

    return NextResponse.json({
      source,
      count: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
