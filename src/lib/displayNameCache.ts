const STORAGE_KEY = "futevolei-display-name";

interface CachedName {
  userId: string;
  name: string;
}

/** Local fallback cache so a returning visitor's name shows instantly, and
 * survives even if the Supabase write that set it originally had failed. */
export function readCachedDisplayName(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedName;
    return parsed.userId === userId ? parsed.name : null;
  } catch {
    return null;
  }
}

export function writeCachedDisplayName(userId: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, name } satisfies CachedName));
  } catch {
    // ignore quota/storage errors
  }
}
