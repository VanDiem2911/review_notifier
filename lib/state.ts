import { promises as fs } from "node:fs";
import path from "node:path";
import type { Collection } from "mongodb";
import type { SourceName } from "./types";

export type State = Partial<Record<SourceName, string[]>>;

const KEY = "review-notifier:state";
const FILE = path.join(process.cwd(), ".data", "state.json");

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisCmd(r: { url: string; token: string }, cmd: string[]) {
  const res = await fetch(r.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  return ((await res.json()) as { result: string | null }).result;
}

// Giữ client giữa các lần gọi để serverless không mở kết nối mới mỗi lần
const globalForMongo = globalThis as unknown as { _mongo?: Promise<Collection<{ _id: string; state: State }>> };

function mongoCollection() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  globalForMongo._mongo ??= (async () => {
    const { MongoClient } = await import("mongodb");
    const client = await new MongoClient(uri).connect();
    return client.db(process.env.MONGODB_DB?.trim() || "review_notifier").collection<{ _id: string; state: State }>("state");
  })();
  return globalForMongo._mongo;
}

export async function loadState(): Promise<State> {
  const mongo = mongoCollection();
  if (mongo) return (await (await mongo).findOne({ _id: KEY }))?.state ?? {};
  const r = redis();
  if (r) {
    const v = await redisCmd(r, ["GET", KEY]);
    return v ? JSON.parse(v) : {};
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function saveState(state: State) {
  const mongo = mongoCollection();
  if (mongo) {
    await (await mongo).updateOne({ _id: KEY }, { $set: { state } }, { upsert: true });
    return;
  }
  const r = redis();
  if (r) {
    await redisCmd(r, ["SET", KEY, JSON.stringify(state)]);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
}
