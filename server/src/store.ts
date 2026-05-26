import type { WebAuthnCredential } from "@simplewebauthn/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "credentials.json");

// In-memory credential store, persisted to JSON file
const users = new Map<string, WebAuthnCredential[]>();

// Load from disk on startup
function load(): void {
  try {
    if (!existsSync(DB_PATH)) return;
    const raw = readFileSync(DB_PATH, "utf-8");
    const data: [string, WebAuthnCredential[]][] = JSON.parse(raw);
    for (const [username, creds] of data) {
      users.set(username, creds);
    }
    console.log(`Loaded ${users.size} user(s) from disk`);
  } catch (err) {
    console.error("Failed to load credentials from disk:", err);
  }
}

// Persist to disk on every write
function persist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const data = Array.from(users.entries());
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist credentials:", err);
  }
}

load();

export function getCredentials(username: string): WebAuthnCredential[] {
  return users.get(username) ?? [];
}

export function saveCredential(username: string, credential: WebAuthnCredential): void {
  const existing = getCredentials(username);
  existing.push(credential);
  users.set(username, existing);
  persist();
}

export function persistCredentials(): void {
  persist();
}

export function findCredential(
  username: string,
  credentialId: string,
): WebAuthnCredential | undefined {
  return getCredentials(username).find((c) => c.id === credentialId);
}

// Challenge store — ephemeral, no persistence needed
const challenges = new Map<string, string>();

export function saveChallenge(key: string, challenge: string): void {
  challenges.set(key, challenge);
}

export function consumeChallenge(key: string): string | undefined {
  const c = challenges.get(key);
  challenges.delete(key);
  return c;
}
