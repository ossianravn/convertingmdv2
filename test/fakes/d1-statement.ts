import type { UsagePeriod, UsageScope } from "../../src/types/usage";
import {
  counterKey,
  counterRow,
  type ApiKeyDbRow,
  type ConversionEventDbRow,
  type CounterDbRow,
  type MemoryD1State
} from "./d1-rows";

type CounterColumn = keyof Pick<
  CounterDbRow,
  | "requests"
  | "native_requests"
  | "ai_requests"
  | "browser_requests"
  | "image_requests"
  | "browser_ms_used"
  | "browser_ms_reserved"
  | "bytes_in"
  | "bytes_out"
>;

export class MemoryStatement {
  private values: unknown[] = [];

  constructor(
    private readonly state: MemoryD1State,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this as unknown as D1PreparedStatement;
  }

  async first<T>(): Promise<T | null> {
    const sql = normalized(this.sql);
    if (sql.includes("from api_keys") && sql.includes("where key_hash = ?")) {
      return (this.state.apiKeys.find((row) => row.key_hash === asString(this.values[0])) ?? null) as T | null;
    }
    if (sql.includes("from api_keys") && sql.includes("where id = ?")) {
      return (this.state.apiKeys.find((row) => row.id === asString(this.values[0])) ?? null) as T | null;
    }
    if (sql.includes("from usage_counters") && sql.includes("where scope = ?")) {
      return this.findCounter() as T | null;
    }

    throw new Error(`Unsupported first() SQL: ${this.sql}`);
  }

  async all<T>(): Promise<D1Result<T>> {
    const sql = normalized(this.sql);
    if (sql.includes("from api_keys")) {
      return d1Result([...this.state.apiKeys].reverse() as T[]);
    }
    if (sql.includes("from usage_counters")) {
      return d1Result([...this.state.counters.values()] as T[]);
    }
    if (sql.includes("from conversion_events")) {
      return d1Result(this.listConversionEvents() as T[]);
    }

    throw new Error(`Unsupported all() SQL: ${this.sql}`);
  }

  async run(): Promise<D1Result> {
    const sql = normalized(this.sql);
    if (sql.startsWith("insert into api_keys")) this.insertApiKey();
    else if (sql.startsWith("insert into conversion_events")) this.insertConversionEvent();
    else if (sql.startsWith("update api_keys set last_used_at")) this.touchApiKey();
    else if (sql.startsWith("update api_keys set")) this.patchApiKey();
    else if (sql.startsWith("insert or ignore into usage_counters")) this.ensureCounter();
    else if (sql.startsWith("update usage_counters set")) this.incrementCounter();
    else throw new Error(`Unsupported run() SQL: ${this.sql}`);

    return d1Result([]);
  }

  private insertApiKey(): void {
    this.state.apiKeys.push({
      id: asString(this.values[0]),
      name: asString(this.values[1]),
      prefix: asString(this.values[2]),
      key_hash: asString(this.values[3]),
      status: asString(this.values[4]),
      daily_request_limit: asNumber(this.values[5]),
      monthly_request_limit: asNumber(this.values[6]),
      allow_browser: asNumber(this.values[7]),
      auto_browser_fallback: asNumber(this.values[8]),
      daily_browser_ms_limit: asNumber(this.values[9]),
      monthly_browser_ms_limit: asNumber(this.values[10]),
      allow_images: asNumber(this.values[11]),
      daily_image_limit: asNumber(this.values[12]),
      monthly_image_limit: asNumber(this.values[13]),
      created_at: asString(this.values[14]),
      updated_at: asString(this.values[15]),
      last_used_at: null
    });
  }

  private insertConversionEvent(): void {
    const row: ConversionEventDbRow = {
      id: asString(this.values[0]),
      api_key_id: asNullableString(this.values[1]),
      request_id: asString(this.values[2]),
      url_hash: asString(this.values[3]),
      host: asString(this.values[4]),
      method: asNullableString(this.values[5]),
      status: asString(this.values[6]),
      status_code: asNumber(this.values[7]),
      cache_status: asString(this.values[8]),
      source_content_type: asNullableString(this.values[9]),
      input_bytes: asNumber(this.values[10]),
      output_bytes: asNumber(this.values[11]),
      browser_ms_used: asNumber(this.values[12]),
      error_code: asNullableString(this.values[13]),
      created_at: asString(this.values[14])
    };
    this.state.conversionEvents.push(row);
  }

  private touchApiKey(): void {
    const row = this.state.apiKeys.find((key) => key.id === asString(this.values[2]));
    if (!row) return;
    row.last_used_at = asString(this.values[0]);
    row.updated_at = asString(this.values[1]);
  }

  private patchApiKey(): void {
    const columns = patchColumns(this.sql);
    const row = this.state.apiKeys.find((key) => key.id === asString(this.values[columns.length + 1]));
    if (!row) return;

    columns.forEach((column, index) => {
      setApiKeyColumn(row, column, this.values[index]);
    });
    row.updated_at = asString(this.values[columns.length]);
  }

  private ensureCounter(): void {
    const row = counterRow({
      scope: asUsageScope(this.values[0]),
      scope_id: asString(this.values[1]),
      period: asUsagePeriod(this.values[2]),
      period_key: asString(this.values[3]),
      created_at: asString(this.values[4]),
      updated_at: asString(this.values[5])
    });
    const key = counterKey(row.scope, row.scope_id, row.period, row.period_key);
    if (!this.state.counters.has(key)) this.state.counters.set(key, row);
  }

  private incrementCounter(): void {
    const column = counterColumn(this.sql);
    const row = this.findCounter(2);
    if (!row) throw new Error("Counter row must exist before increment.");
    row[column] += asNumber(this.values[0]);
    row.updated_at = asString(this.values[1]);
  }

  private findCounter(offset = 0): CounterDbRow | null {
    return (
      this.state.counters.get(
        counterKey(
          asUsageScope(this.values[offset]),
          asString(this.values[offset + 1]),
          asUsagePeriod(this.values[offset + 2]),
          asString(this.values[offset + 3])
        )
      ) ?? null
    );
  }

  private listConversionEvents(): ConversionEventDbRow[] {
    const limit = typeof this.values[0] === "number" ? this.values[0] : this.state.conversionEvents.length;
    return [...this.state.conversionEvents].sort(descendingCreatedAt).slice(0, limit);
  }
}

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function d1Result<T>(results: T[]): D1Result<T> {
  return { success: true, results, meta: {} } as D1Result<T>;
}

function descendingCreatedAt(left: ConversionEventDbRow, right: ConversionEventDbRow): number {
  return right.created_at.localeCompare(left.created_at);
}

function patchColumns(sql: string): string[] {
  const match = /set\s+(.+),\s+updated_at\s+=\s+\?/is.exec(sql);
  if (!match?.[1]) throw new Error("Could not parse api_keys patch columns.");
  return match[1].split(",").map((part) => part.split("=")[0]?.trim() ?? "");
}

function counterColumn(sql: string): CounterColumn {
  const match = /set\s+([a-z_]+)\s+=/i.exec(sql);
  if (!match?.[1]) throw new Error("Could not parse counter column.");
  return match[1] as CounterColumn;
}

function setApiKeyColumn(row: ApiKeyDbRow, column: string, value: unknown): void {
  if (typeof row[column as keyof ApiKeyDbRow] === "number") {
    (row as unknown as Record<string, unknown>)[column] = asNumber(value);
    return;
  }

  (row as unknown as Record<string, unknown>)[column] = asString(value);
}

function asString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected string bind value.");
  return value;
}

function asNullableString(value: unknown): string | null {
  if (value === null) return null;
  return asString(value);
}

function asNumber(value: unknown): number {
  if (typeof value !== "number") throw new Error("Expected number bind value.");
  return value;
}

function asUsageScope(value: unknown): UsageScope {
  const scope = asString(value);
  if (scope !== "key" && scope !== "global") throw new Error("Expected usage scope.");
  return scope;
}

function asUsagePeriod(value: unknown): UsagePeriod {
  const period = asString(value);
  if (period !== "day" && period !== "month") throw new Error("Expected usage period.");
  return period;
}
