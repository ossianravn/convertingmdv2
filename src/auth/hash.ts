import { bytesToHex } from "../utils/crypto";

export async function hashApiKey(apiKey: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(apiKey));
  return bytesToHex(new Uint8Array(signature));
}

