const MINUTE_MS = 60_000;

// Milliseconds until the next whole minute; a full minute when already on a boundary.
export function msUntilNextMinute(now: Date): number {
  return MINUTE_MS - (now.getTime() % MINUTE_MS);
}
