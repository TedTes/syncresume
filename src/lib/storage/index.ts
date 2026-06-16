import { LocalStorageAdapter } from "./localAdapter";
import { SupabaseStorageAdapter } from "./supabaseAdapter";
import { CloudflareStorageAdapter } from "./cloudflareAdapter";
import type { StorageAdapter } from "./types";
import { hasCloudflareConfig } from "../cloudflare/client";
import { hasSupabaseConfig } from "../supabase/client";

export function createStorageAdapter(): StorageAdapter {
  if (hasCloudflareConfig()) return new CloudflareStorageAdapter();
  return hasSupabaseConfig() ? new SupabaseStorageAdapter() : new LocalStorageAdapter();
}

export const storage: StorageAdapter = createStorageAdapter();

export * from "./types";
