export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

