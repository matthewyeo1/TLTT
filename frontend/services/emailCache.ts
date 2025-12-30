let cachedEmails: any[] | null = null;
let lastFetchedAt: number | null = null;

export function getCachedEmails() {
  return cachedEmails;
}

export function setCachedEmails(emails: any[]) {
  cachedEmails = emails;
  lastFetchedAt = Date.now();
}

export function clearEmailCache() {
  cachedEmails = null;
  lastFetchedAt = null;
}

export function isCacheStale(maxAgeMs = 5 * 60 * 1000) {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > maxAgeMs;
}
