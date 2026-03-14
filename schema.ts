
/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

/**
 * 藝術作品生成記錄表
 * 儲存用戶上傳的作品及生成的三個視角模擬圖
 */
export const artworkGenerations = mysqlTable("artworkGenerations", {
  id: int("id").autoincrement().primaryKey(),
  /** 關聯的用戶 ID */
  userId: int("userId").notNull(),
  /** 原始作品圖片的 S3 URL */
  originalImageUrl: text("originalImageUrl").notNull(),
  /** 原始作品圖片的 S3 key */
  originalImageKey: text("originalImageKey").notNull(),
  /** 作品方向：portrait(直式), landscape(橫式), square(正方形) */
  orientation: mysqlEnum("orientation", ["portrait", "landscape", "square"]).notNull(),
  /** 鋁框顏色 */
  frameColor: varchar("frameColor", { length: 50 }).notNull(),
  /** 房間風格：japanese(日本), nordic(北歐), american(美國), rustic(鄉村), wooden-floor(木頁地板), artist-holding(藝術家手拿畫作), bedroom-with-eaves(屋粗臥房) */
  roomStyle: mysqlEnum("roomStyle", ["japanese", "nordic", "american", "rustic", "wooden-floor", "artist-holding", "bedroom-with-eaves"]).notNull(),
  /** 左45度視角生成圖的 S3 URL */
  leftAngleImageUrl: text("leftAngleImageUrl"),
  /** 左45度視角生成圖的 S3 key */
  leftAngleImageKey: text("leftAngleImageKey"),
  /** 正面視角生成圖的 S3 URL */