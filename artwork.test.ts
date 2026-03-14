import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("artwork router", () => {
  describe("uploadOriginalImage", () => {
    it("should require authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.artwork.uploadOriginalImage({
          imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          mimeType: "image/png",
        })
      ).rejects.toThrow();
    });

    it("should upload image and return URL and key", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // 使用一個最小的有效 base64 PNG 圖片
      const result = await caller.artwork.uploadOriginalImage({
        imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mimeType: "image/png",
      });

      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("key");
      expect(typeof result.url).toBe("string");
      expect(typeof result.key).toBe("string");
      expect(result.key).toContain(`artwork-originals/${ctx.user!.id}/`);
    });
  });

  describe("generateMockups", () => {
    it("should require authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.artwork.generateMockups({
          originalImageUrl: "https://example.com/image.jpg",
          originalImageKey: "test-key",
          originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          orientation: "portrait",
          frameColor: "matte-black",
          roomStyle: "nordic",
          viewAngles: ["front"],
          imageGenerationCore: "manus",
        })
      ).rejects.toThrow();
    });

    it("should create generation record and return generation ID", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-image.jpg",
        originalImageKey: "test-key-123",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "portrait",
        frameColor: "matte-black",
        roomStyle: "nordic",
        viewAngles: ["left", "front", "right"],
        imageGenerationCore: "manus",
      });

      expect(result).toHaveProperty("generationId");
      expect(typeof result.generationId).toBe("number");
      expect(result.generationId).toBeGreaterThan(0);
    });

    it("should support artist-holding room style", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-image.jpg",
        originalImageKey: "test-key-artist",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "portrait",
        frameColor: "matte-gold",
        roomStyle: "artist-holding",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      expect(result).toHaveProperty("generationId");
      expect(typeof result.generationId).toBe("number");
      expect(result.generationId).toBeGreaterThan(0);
    });
  });

  describe("getGeneration", () => {
    it("should require authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(caller.artwork.getGeneration({ id: 1 })).rejects.toThrow();
    });

    it("should return generation for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // 先創建一個生成記錄
      const { generationId } = await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-image.jpg",
        originalImageKey: "test-key-456",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "landscape",
        frameColor: "white",
        roomStyle: "artist-holding",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      // 獲取生成記錄
      const generation = await caller.artwork.getGeneration({ id: generationId });

      expect(generation).toBeDefined();
      expect(generation.id).toBe(generationId);
      expect(generation.userId).toBe(ctx.user!.id);
      expect(generation.orientation).toBe("landscape");
      expect(generation.frameColor).toBe("white");
      expect(generation.roomStyle).toBe("artist-holding");
      expect(generation.status).toBe("processing");
    });

    it("should not allow access to other users' generations", async () => {
      const ctx1 = createAuthContext(1);
      const caller1 = appRouter.createCaller(ctx1);

      // 用戶 1 創建生成記錄
      const { generationId } = await caller1.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-image.jpg",
        originalImageKey: "test-key-789",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "square",
        frameColor: "matte-gold",
        roomStyle: "artist-holding",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      // 用戶 2 嘗試訪問用戶 1 的生成記錄
      const ctx2 = createAuthContext(2);
      const caller2 = appRouter.createCaller(ctx2);

      await expect(caller2.artwork.getGeneration({ id: generationId })).rejects.toThrow("Generation not found");
    });
  });

  describe("listGenerations", () => {
    it("should require authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(caller.artwork.listGenerations()).rejects.toThrow();
    });

    it("should return user's generations", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // 創建幾個生成記錄
      await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/image1.jpg",
        originalImageKey: "key-1",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "portrait",
        frameColor: "matte-black",
        roomStyle: "nordic",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/image2.jpg",
        originalImageKey: "key-2",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "landscape",
        frameColor: "white",
        roomStyle: "artist-holding",
        viewAngles: ["left", "right"],
        imageGenerationCore: "manus",
      });

      const generations = await caller.artwork.listGenerations();

      expect(Array.isArray(generations)).toBe(true);
      expect(generations.length).toBeGreaterThanOrEqual(2);
      
      // 驗證所有記錄都屬於當前用戶
      generations.forEach((gen) => {
        expect(gen.userId).toBe(ctx.user!.id);
      });
    });
  });

  describe("deleteGeneration", () => {
    it("should require authentication", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(caller.artwork.deleteGeneration({ id: 1 })).rejects.toThrow();
    });

    it("should delete user's own generation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // 創建生成記錄
      const { generationId } = await caller.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-delete.jpg",
        originalImageKey: "delete-key",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "portrait",
        frameColor: "matte-black",
        roomStyle: "artist-holding",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      // 刪除記錄
      const result = await caller.artwork.deleteGeneration({ id: generationId });
      expect(result.success).toBe(true);

      // 驗證記錄已被刪除
      await expect(caller.artwork.getGeneration({ id: generationId })).rejects.toThrow("Generation not found");
    });

    it("should not allow deleting other users' generations", async () => {
      const ctx1 = createAuthContext(1);
      const caller1 = appRouter.createCaller(ctx1);

      // 用戶 1 創建生成記錄
      const { generationId } = await caller1.artwork.generateMockups({
        originalImageUrl: "https://example.com/test-image.jpg",
        originalImageKey: "test-key",
        originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        orientation: "portrait",
        frameColor: "matte-gold",
        roomStyle: "artist-holding",
        viewAngles: ["front"],
        imageGenerationCore: "manus",
      });

      // 用戶 2 嘗試刪除用戶 1 的記錄
      const ctx2 = createAuthContext(2);
      const caller2 = appRouter.createCaller(ctx2);

      await expect(caller2.artwork.deleteGeneration({ id: generationId })).rejects.toThrow("Generation not found");
    });
  });
});
