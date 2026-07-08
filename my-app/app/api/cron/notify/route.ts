import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { Redis } from "@upstash/redis";
import { queryNotionDatabase, collectNotionPageInfo } from "../../notion/notion.js";

export const runtime = "nodejs";

const SUBSCRIPTIONS_KEY = "push:subscriptions";

const TODO_DATABASE_ID = "38fa15fd-a3c1-80bd-98d9-ddcfe8406a93"; // 進捗管理
const SCHEDULE_DATABASE_ID = "38fa15fd-a3c1-80fa-a200-d99ac64b3409"; // スケジュール
const SCHEDULE_WINDOW_HOURS = 1;

const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
const contact = process.env.WEB_PUSH_CONTACT;

if (publicKey && privateKey && contact) {
  webpush.setVapidDetails(contact, publicKey, privateKey);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

// 「進捗管理」から期限超過タスクの名前一覧を取得する
async function getOverdueTasks(): Promise<string[]> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return [];

  const pages = await queryNotionDatabase(apiKey, TODO_DATABASE_ID, 50, 2);
  const tasks = pages.map((page: any) => collectNotionPageInfo(page));

  return tasks
    .filter((task: any) => {
      const statusName = task.properties?.["ステータス"]?.name || "";
      const overdue = Boolean(task.properties?.["期限超過"]);
      return statusName !== "完了" && overdue;
    })
    .map((task: any) => task.properties?.["タスク名"] || task.title || "無題");
}

// 「スケジュール」から直近1時間以内に始まる予定の名前・時刻一覧を取得する
async function getUpcomingSchedule(): Promise<{ name: string; time: string }[]> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return [];

  const pages = await queryNotionDatabase(apiKey, SCHEDULE_DATABASE_ID, 50, 2);
  const events = pages.map((page: any) => collectNotionPageInfo(page));

  const now = new Date();
  const windowEnd = new Date(now.getTime() + SCHEDULE_WINDOW_HOURS * 60 * 60 * 1000);

  return events
    .filter((event: any) => {
      const start = event.properties?.["日時"]?.start;
      if (!start) return false;
      const startDate = new Date(start);
      return startDate >= now && startDate < windowEnd;
    })
    .map((event: any) => {
      const start = new Date(event.properties["日時"].start);
      const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      return { name: event.properties?.["予定"] || event.title || "無題", time };
    });
}

function buildNotificationBody(overdueTasks: string[], upcomingEvents: { name: string; time: string }[]): string | null {
  const lines: string[] = [];

  if (upcomingEvents.length > 0) {
    lines.push(`【この後${SCHEDULE_WINDOW_HOURS}時間以内の予定】`);
    for (const event of upcomingEvents) {
      lines.push(`・${event.time} ${event.name}`);
    }
  }

  if (overdueTasks.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("【期限超過のタスク】");
    for (const name of overdueTasks) {
      lines.push(`・${name}`);
    }
  }

  if (lines.length === 0) return null;
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(publicKey && privateKey && contact)) {
    return NextResponse.json({ error: "VAPID keys are not configured on the server" }, { status: 500 });
  }

  const [overdueTasks, upcomingEvents] = await Promise.all([
    getOverdueTasks(),
    getUpcomingSchedule(),
  ]);

  const notificationBody = buildNotificationBody(overdueTasks, upcomingEvents);
  if (!notificationBody) {
    return NextResponse.json({ sent: false, reason: "no relevant Notion updates" });
  }

  const redis = Redis.fromEnv();
  const subscriptions = await redis.smembers(SUBSCRIPTIONS_KEY);
  const payload = JSON.stringify({ title: "Noirからのお知らせ", body: notificationBody });

  let sentCount = 0;
  for (const raw of subscriptions) {
    const subscription = typeof raw === "string" ? JSON.parse(raw) : raw;
    try {
      await webpush.sendNotification(subscription, payload);
      sentCount += 1;
    } catch (error: any) {
      // 期限切れ・無効な購読は保存先から削除しておく
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await redis.srem(SUBSCRIPTIONS_KEY, raw);
      } else {
        console.error("[cron/notify] sendNotification failed", error);
      }
    }
  }

  return NextResponse.json({
    sent: true,
    sentCount,
    overdueCount: overdueTasks.length,
    upcomingCount: upcomingEvents.length,
  });
}
