import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// プッシュ購読情報を保存しておくRedisのキー（Setで複数端末分をまとめて管理）
const SUBSCRIPTIONS_KEY = "push:subscriptions";

function validateSubscription(subscription: any): boolean {
  return !!(
    subscription?.endpoint &&
    subscription?.keys?.p256dh &&
    subscription?.keys?.auth
  );
}

export async function POST(request: NextRequest) {
  const redis = Redis.fromEnv();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subscription = body?.subscription;
  if (!validateSubscription(subscription)) {
    return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
  }

  // 同じendpointの購読が既にあれば実質的に重複しないよう、文字列化したものをSetに追加する
  await redis.sadd(SUBSCRIPTIONS_KEY, JSON.stringify(subscription));

  return NextResponse.json({ ok: true });
}
