import { MemoryStatement } from "./d1-statement";
import { counterKey, type ApiKeyDbRow, type ConversionEventDbRow, type CounterDbRow, type MemoryD1State } from "./d1-rows";

export type { ApiKeyDbRow, ConversionEventDbRow, CounterDbRow } from "./d1-rows";
export { apiKeyRow, conversionEventRow, counterRow } from "./d1-rows";

export interface MemoryD1 {
  database: D1Database;
  apiKeys: ApiKeyDbRow[];
  counters: Map<string, CounterDbRow>;
  conversionEvents: ConversionEventDbRow[];
  seedApiKey(row: ApiKeyDbRow): void;
  seedCounter(row: CounterDbRow): void;
  seedConversionEvent(row: ConversionEventDbRow): void;
}

export function createMemoryD1(): MemoryD1 {
  const state: MemoryD1State = { apiKeys: [], counters: new Map(), conversionEvents: [] };
  return {
    database: {
      prepare(sql: string) {
        return new MemoryStatement(state, sql) as unknown as D1PreparedStatement;
      }
    } as unknown as D1Database,
    apiKeys: state.apiKeys,
    counters: state.counters,
    conversionEvents: state.conversionEvents,
    seedApiKey(row) {
      state.apiKeys.push(row);
    },
    seedCounter(row) {
      state.counters.set(counterKey(row.scope, row.scope_id, row.period, row.period_key), row);
    },
    seedConversionEvent(row) {
      state.conversionEvents.push(row);
    }
  };
}
