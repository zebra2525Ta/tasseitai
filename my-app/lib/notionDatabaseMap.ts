import { Redis } from "@upstash/redis";
import { findDatabaseIdByTitle } from "@/app/api/notion/notion.js";

// 各トピックの既定データベースID（共有チームワークスペース向け）。
// 個人ワークスペースでは基本的に使われず、自動検出にも失敗した場合の最終フォールバックとしてのみ使う。
export type NotionTopicId = "shopping" | "todo" | "schedule" | "jobhunting" | "memo";

export const DEFAULT_DATABASE_IDS: Record<NotionTopicId, string> = {
  shopping: "38fa15fd-a3c1-8049-8041-ebf679d048b2",
  todo: "38fa15fd-a3c1-80bd-98d9-ddcfe8406a93",
  schedule: "38fa15fd-a3c1-80fa-a200-d99ac64b3409",
  jobhunting: "38fa15fd-a3c1-8076-80ad-dc57719ac014",
  memo: "38fa15fd-a3c1-80ed-b95d-ea990af2b963",
};

// 自動検出時に検索する、各トピックの正式なデータベース名
export const TOPIC_LABELS: Record<NotionTopicId, string> = {
  shopping: "買い物リスト",
  todo: "進捗管理",
  schedule: "スケジュール",
  jobhunting: "就活",
  memo: "未分類メモ",
};

const TOPIC_IDS = Object.keys(DEFAULT_DATABASE_IDS) as NotionTopicId[];

function overrideKey(userId: string): string {
  return `notion:databases:${userId}`;
}

// 自動検出で見つかったIDのキャッシュ（毎回Notionを検索しに行かないため）
function discoveredKey(userId: string): string {
  return `notion:databases:auto:${userId}`;
}

function isTopicId(value: string): value is NotionTopicId {
  return (TOPIC_IDS as string[]).includes(value);
}

// ユーザーが個別に登録したデータベースIDのみを返す（未設定のトピックは含まない）
export async function getUserDatabaseOverrides(userId: string): Promise<Partial<Record<NotionTopicId, string>>> {
  const redis = Redis.fromEnv();
  const stored = await redis.hgetall<Record<string, string>>(overrideKey(userId));
  if (!stored) return {};

  const overrides: Partial<Record<NotionTopicId, string>> = {};
  for (const [topic, databaseId] of Object.entries(stored)) {
    if (isTopicId(topic) && databaseId) {
      overrides[topic] = databaseId;
    }
  }
  return overrides;
}

// 手動設定・自動検出のどちらでも見つからなかったトピック名を一緒に返す
// （見つからなかった場合は共有ワークスペースの既定値にフォールバックするが、
//   呼び出し側が「本当に確認できた値か」を判断できるようにunresolvedを見せる）
export async function getUserDatabaseMap(
  userId: string,
  apiKey?: string | null
): Promise<{ databases: Record<NotionTopicId, string>; unresolved: NotionTopicId[] }> {
  const redis = Redis.fromEnv();
  const overrides = await getUserDatabaseOverrides(userId);
  const cached = (await redis.hgetall<Record<string, string>>(discoveredKey(userId))) || {};

  const databases = {} as Record<NotionTopicId, string>;
  const unresolved: NotionTopicId[] = [];

  for (const topic of TOPIC_IDS) {
    if (overrides[topic]) {
      databases[topic] = overrides[topic]!;
      continue;
    }

    if (cached[topic]) {
      databases[topic] = cached[topic];
      continue;
    }

    // 手動設定もキャッシュも無い場合のみ、Notionを検索して自動検出を試みる
    let discoveredId: string | null = null;
    if (apiKey) {
      try {
        discoveredId = await findDatabaseIdByTitle(apiKey, TOPIC_LABELS[topic]);
      } catch (error) {
        console.error(`Notionデータベースの自動検出に失敗(${topic}):`, error);
      }
    }

    if (discoveredId) {
      databases[topic] = discoveredId;
      await redis.hset(discoveredKey(userId), { [topic]: discoveredId });
    } else {
      // 見つからない・複数候補があって一意に決まらない場合は「未解決」として記録し、
      // 既定値をそのまま使うと別ワークスペースの無関係なデータベースを指してしまうため、
      // 呼び出し側で「見つからない」と扱えるようにする
      databases[topic] = DEFAULT_DATABASE_IDS[topic];
      unresolved.push(topic);
    }
  }

  return { databases, unresolved };
}

// databaseId が空文字なら「既定に戻す（自動検出に任せる）」扱いにする
export async function setUserDatabaseId(userId: string, topic: NotionTopicId, databaseId: string): Promise<void> {
  const redis = Redis.fromEnv();
  const trimmed = databaseId.trim();
  if (trimmed) {
    await redis.hset(overrideKey(userId), { [topic]: trimmed });
  } else {
    await redis.hdel(overrideKey(userId), topic);
    // 上書きを消したら、古い自動検出結果も消して次回また検索し直させる
    await redis.hdel(discoveredKey(userId), topic);
  }
}
