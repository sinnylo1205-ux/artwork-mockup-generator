import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "./drizzle/schema";
import { artworkGenerations, InsertArtworkGeneration, ArtworkGeneration } from "./drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// 無 DATABASE_URL 時用記憶體存 artwork 記錄，重啟後清空
type MemoryRecord = ArtworkGeneration;
const _memoryStore: MemoryRecord[] = [];
let _memoryId = 0;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const v = user[field];
    if (v !== undefined) {
      (values as any)[field] = v ?? null;
      updateSet[field] = v ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function createArtworkGeneration(data: InsertArtworkGeneration): Promise<ArtworkGeneration> {
  const db = await getDb();
  if (db) {
    const raw = await db.insert(artworkGenerations).values(data);
    const result = Array.isArray(raw) ? raw[0] : raw;
    const id = (result as { insertId?: number })?.insertId;
    if (id == null) throw new Error("Failed to get insert id");
    const rows = await db.select().from(artworkGenerations).where(eq(artworkGenerations.id, id)).limit(1);
    if (!rows[0]) throw new Error("Failed to read back artwork generation");
    return rows[0];
  }
  _memoryId += 1;
  const now = new Date();
  const record: MemoryRecord = {
    id: _memoryId,
    userId: data.userId,
    originalImageUrl: data.originalImageUrl,
    originalImageKey: data.originalImageKey,
    orientation: data.orientation,
    frameColor: data.frameColor,
    roomStyle: data.roomStyle,
    leftAngleImageUrl: null,
    leftAngleImageKey: null,
    frontImageUrl: null,
    frontImageKey: null,
    rightAngleImageUrl: null,
    rightAngleImageKey: null,
    status: data.status ?? "processing",
    errorMessage: null,
    batchId: data.batchId ?? null,
    imageGenerationCore: data.imageGenerationCore ?? "replicate",
    createdAt: now,
    updatedAt: now,
  };
  _memoryStore.push(record);
  return record;
}

export async function updateArtworkGeneration(
  id: number,
  data: Partial<InsertArtworkGeneration>
): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.update(artworkGenerations).set(data).where(eq(artworkGenerations.id, id));
    return;
  }
  const idx = _memoryStore.findIndex((r) => r.id === id);
  if (idx === -1) return;
  _memoryStore[idx] = { ..._memoryStore[idx], ...data, updatedAt: new Date() } as MemoryRecord;
}

export async function getUserArtworkGenerations(userId: number) {
  const db = await getDb();
  if (db) {
    return db
      .select()
      .from(artworkGenerations)
      .where(eq(artworkGenerations.userId, userId))
      .orderBy(desc(artworkGenerations.createdAt));
  }
  return _memoryStore
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getArtworkGenerationById(id: number) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(artworkGenerations).where(eq(artworkGenerations.id, id)).limit(1);
    return rows[0];
  }
  return _memoryStore.find((r) => r.id === id);
}

export async function deleteArtworkGeneration(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.delete(artworkGenerations).where(eq(artworkGenerations.id, id));
    return;
  }
  const idx = _memoryStore.findIndex((r) => r.id === id && r.userId === userId);
  if (idx !== -1) _memoryStore.splice(idx, 1);
}
