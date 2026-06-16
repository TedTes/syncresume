import { LocalStorageAdapter } from "./localAdapter";
import type { StorageAdapter } from "./types";

// Swap this single line to `new SupabaseStorageAdapter()` once that backend
// is wired up (see supabaseAdapter.ts) — nothing else in the app depends on
// which adapter is active.
export const storage: StorageAdapter = new LocalStorageAdapter();

export * from "./types";
