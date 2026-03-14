import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";
import { uploadToSupabaseStorage } from "./supabase";

const UPLOAD_DIR = path.join(process.cwd(), "server", "uploads");
const BASE_URL = process.env.VITE_API_URL || "http://localhost:5000";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function storagePut(key: string, buffer: Buffer, mimeType: string): Promise<{ url: string }> {
  if (ENV.supabaseUrl && ENV.supabaseAnonKey) {
    return uploadToSupabaseStorage(key, buffer, mimeType);
  }
  ensureDir(UPLOAD_DIR);
  const fullPath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(fullPath);
  ensureDir(dir);
  fs.writeFileSync(fullPath, buffer);
  const url = `${BASE_URL}/api/uploads/${key}`;
  return { url };
}
