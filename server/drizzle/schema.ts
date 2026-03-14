import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const artworkGenerations = mysqlTable("artworkGenerations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  originalImageUrl: text("originalImageUrl").notNull(),
  originalImageKey: text("originalImageKey").notNull(),
  orientation: mysqlEnum("orientation", ["portrait", "landscape", "square"]).notNull(),
  frameColor: varchar("frameColor", { length: 50 }).notNull(),
  roomStyle: mysqlEnum("roomStyle", [
    "japanese",
    "nordic",
    "american",
    "rustic",
    "wooden-floor",
    "artist-holding",
    "bedroom-with-eaves",
  ]).notNull(),
  leftAngleImageUrl: text("leftAngleImageUrl"),
  leftAngleImageKey: text("leftAngleImageKey"),
  frontImageUrl: text("frontImageUrl"),
  frontImageKey: text("frontImageKey"),
  rightAngleImageUrl: text("rightAngleImageUrl"),
  rightAngleImageKey: text("rightAngleImageKey"),
  status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(),
  errorMessage: text("errorMessage"),
  batchId: varchar("batchId", { length: 128 }),
  imageGenerationCore: mysqlEnum("imageGenerationCore", ["manus", "openai", "replicate"]).default("replicate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ArtworkGeneration = typeof artworkGenerations.$inferSelect;
export type InsertArtworkGeneration = typeof artworkGenerations.$inferInsert;
