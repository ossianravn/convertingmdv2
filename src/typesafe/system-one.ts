// Minimal client for TypeSafe's System One API (https://docs.typesafe.ai/api/system-one).
// Only Choice questions are needed here; the answer is validated before use.
const endpoint = "https://api.typesafe.ai/v1/systemone";
const timeoutMs = 8000;

export interface ChoiceQuestion<Option extends string> {
  instructions: string;
  criteria: Record<Option, string>;
}

export interface ChoiceAnswer<Option extends string> {
  choice: Option;
  probabilities: Record<Option, number>;
  model: string;
}

// Every failure to get an answer (network, timeout, HTTP, malformed body)
// surfaces as this one type, so callers can decide how to degrade.
export class TypeSafeError extends Error {
  override readonly name = "TypeSafeError";
}

export async function askChoice<Option extends string>(
  apiKey: string,
  model: string,
  state: unknown,
  question: ChoiceQuestion<Option>
): Promise<ChoiceAnswer<Option>> {
  const body = JSON.stringify({ model, state, questions: { answer: { type: "choice", ...question } } });
  return parseChoice(await postJson(apiKey, body), Object.keys(question.criteria) as Option[]);
}

async function postJson(apiKey: string, body: string): Promise<unknown> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new TypeSafeError(`TypeSafe answered HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof TypeSafeError) throw error;
    throw new TypeSafeError(`TypeSafe request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseChoice<Option extends string>(body: unknown, options: Option[]): ChoiceAnswer<Option> {
  const model = readPath(body, ["model"]);
  const answer = readPath(body, ["answers", "answer"]);
  const choice = readPath(answer, ["choice"]);
  const probabilities = readPath(answer, ["probabilities"]);

  if (typeof model !== "string" || !options.includes(choice as Option) || !isRecord(probabilities)) {
    throw new TypeSafeError("TypeSafe returned an unexpected Choice answer.");
  }

  const parsed = {} as Record<Option, number>;
  for (const option of options) {
    const value = probabilities[option];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new TypeSafeError(`TypeSafe returned an invalid probability for ${option}.`);
    }
    parsed[option] = value;
  }

  return { choice: choice as Option, probabilities: parsed, model };
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
