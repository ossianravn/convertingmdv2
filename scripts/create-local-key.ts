import { fileURLToPath } from "node:url";
import { createApiKeySecret, createId } from "../src/utils/crypto";
import { hashApiKey } from "../src/auth/hash";

export interface LocalKeyPayload {
  id: string;
  prefix: string;
  apiKey: string;
  keyHash: string;
}

export async function createLocalKeyPayload(pepper: string): Promise<LocalKeyPayload> {
  const apiKey = `cmd_test_${createApiKeySecret()}`;
  return {
    id: createId("key"),
    prefix: apiKey.slice(0, 17),
    apiKey,
    keyHash: await hashApiKey(apiKey, pepper)
  };
}

async function main(): Promise<void> {
  const pepper = process.env["API_KEY_PEPPER"];
  if (!pepper) {
    throw new Error("API_KEY_PEPPER must be set to create a local key hash.");
  }

  console.log(JSON.stringify(await createLocalKeyPayload(pepper), null, 2));
}

const isCli = fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  void main();
}
