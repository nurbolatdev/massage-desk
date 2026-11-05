import type { SupportedStorage } from "@supabase/supabase-js";

/** The part of expo-secure-store that the chunked storage needs. */
export type ChunkStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

// SecureStore may reject values above 2048 bytes, so stay well below it.
const MAX_CHUNK_BYTES = 1800;

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Cuts the text on code point boundaries so each part is at most MAX_CHUNK_BYTES in UTF-8. */
function split(value: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of value) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (bytes + size > MAX_CHUNK_BYTES) {
      chunks.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  chunks.push(current);
  return chunks;
}

async function readCount(store: ChunkStore, key: string): Promise<number | null> {
  const raw = await store.getItemAsync(`${key}.n`);
  if (raw === null) return null;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

async function removeChunks(store: ChunkStore, key: string, from: number, to: number) {
  for (let i = from; i < to; i++) {
    await store.deleteItemAsync(`${key}.${i}`);
  }
}

export function createChunkedStorage(store: ChunkStore): SupportedStorage {
  return {
    async getItem(key) {
      try {
        const count = await readCount(store, key);
        if (count === null) return null;
        let value = "";
        for (let i = 0; i < count; i++) {
          const chunk = await store.getItemAsync(`${key}.${i}`);
          if (chunk === null) return null;
          value += chunk;
        }
        return value;
      } catch {
        // An unreadable store means "signed out", never a crash.
        return null;
      }
    },

    async setItem(key, value) {
      const previous = (await readCount(store, key)) ?? 0;
      const chunks = split(value);
      for (const [i, chunk] of chunks.entries()) {
        await store.setItemAsync(`${key}.${i}`, chunk);
      }
      await store.setItemAsync(`${key}.n`, String(chunks.length));
      await removeChunks(store, key, chunks.length, previous);
    },

    async removeItem(key) {
      const count = (await readCount(store, key)) ?? 0;
      await removeChunks(store, key, 0, count);
      await store.deleteItemAsync(`${key}.n`);
    },
  };
}
