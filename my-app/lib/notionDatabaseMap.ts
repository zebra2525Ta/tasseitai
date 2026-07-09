import { Redis } from "@upstash/redis";

// 各トピックの既定データベースID（共有チームワークスペース向け）。
// ユーザーが自分のワークスペース用に上書きしていない場合はこれが使われる。
export type NotionTopicId = "shopping" | "todo" | "schedule" | "jobhunting" | "memo";

export const DEFAULT_DATABASE_IDS: Record<NotionTopicId, string> = {
  shopping: "38fa15fd-a3c1-8049-8041-ebf679d048b2",
  todo: "38fa15fd-a3c1-80bd-98d9-ddcfe8406a93",
  schedule: "38fa15fd-a3c1-80fa-a200-d99ac64b3409",
  jobhunting: "38fa15fd-a3c1-8076-80ad-dc57719ac014",
  memo: "38fa15fd-a3c1-80ed-b95d-ea990af2b963",
};

const TOPIC_IDS = Object.keys(DEFAULT_DATABASE_IDS) as NotionTopicId[];

function mapKey(userId: string): string {
  return `notion:databases:${userId}`;
}

function isTopicId(value: string): value is NotionTopicId {
  return (TOPIC_IDS as string[]).includes(value);
}

// ユーザーが個別に登録したデータベースIDのみを返す（未設定のトピックは含まない）
export async function getUserDatabaseOverrides(userId: string): Promise<Partial<Record<NotionTopicId, string>>> {
  const redis = Redis.fromEnv();
  const stored = await redis.hgetall<Record<string, string>>(mapKey(userId));
  if (!stored) return {};

  const overrides: Partial<Record<NotionTopicId, string>> = {};
  for (const [topic, databaseId] of Object.entries(stored)) {
    if (isTopicId(topic) && databaseId) {
      overrides[topic] = databaseId;
    }
  }
  return overrides;
}

// 上書き設定 + 既定値をマージした、実際に使うべきデータベースIDの一覧
export async function getUserDatabaseMap(userId: string): Promise<Record<NotionTopicId, string>> {
  const overrides = await getUserDatabaseOverrides(userId);
  return {
    shopping: overrides.shopping || DEFAULT_DATABASE_IDS.shopping,
    todo: overrides.todo || DEFAULT_DATABASE_IDS.todo,
    schedule: overrides.schedule || DEFAULT_DATABASE_IDS.schedule,
    jobhunting: overrides.jobhunting || DEFAULT_DATABASE_IDS.jobhunting,
    memo: overrides.memo || DEFAULT_DATABASE_IDS.memo,
  };
}

// databaseId が空文字なら「既定に戻す」扱いにする
export async function setUserDatabaseId(userId: string, topic: NotionTopicId, databaseId: string): Promise<void> {
  const redis = Redis.fromEnv();
  const trimmed = databaseId.trim();
  if (trimmed) {
    await redis.hset(mapKey(userId), { [topic]: trimmed });
  } else {
    await redis.hdel(mapKey(userId), topic);
  }
}
