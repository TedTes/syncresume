import { LocalStorageAdapter } from "./localAdapter";
import { SupabaseStorageAdapter } from "./supabaseAdapter";
import type { StorageAdapter } from "./types";
import { hasSupabaseConfig } from "../supabase/client";

export function createStorageAdapter(): StorageAdapter {
  return hasSupabaseConfig() ? new SupabaseStorageAdapter() : new LocalStorageAdapter();
}

export const storage: StorageAdapter = createStorageAdapter();

export * from "./types";
