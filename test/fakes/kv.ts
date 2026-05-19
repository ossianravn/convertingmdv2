export interface MemoryKv {
  namespace: KVNamespace;
  entries: Map<string, string>;
  writes: Array<{ key: string; value: string; expirationTtl?: number }>;
}

export function createMemoryKv(initial: Record<string, unknown> = {}): MemoryKv {
  const entries = new Map<string, string>();
  const writes: MemoryKv["writes"] = [];

  for (const [key, value] of Object.entries(initial)) {
    entries.set(key, JSON.stringify(value));
  }

  return {
    entries,
    writes,
    namespace: {
      async get(key: string, type?: string) {
        const value = entries.get(key);
        if (value === undefined) return null;
        return type === "json" ? JSON.parse(value) : value;
      },
      async put(key: string, value: string, options?: { expirationTtl?: number }) {
        entries.set(key, value);
        const write = options?.expirationTtl === undefined ? { key, value } : { key, value, expirationTtl: options.expirationTtl };
        writes.push(write);
      }
    } as unknown as KVNamespace
  };
}
