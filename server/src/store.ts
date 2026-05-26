import type { WebAuthnCredential } from "@simplewebauthn/server";
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, "webauthn.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_credentials_username ON credentials (username)`);

// ── Prepared statements ────────────────────────────────────────

const stmtGetByUsername = db.prepare("SELECT * FROM credentials WHERE username = ?");
const stmtGetById = db.prepare("SELECT * FROM credentials WHERE id = ?");
const stmtInsert = db.prepare(`
  INSERT INTO credentials (id, username, public_key, counter, transports)
  VALUES (@id, @username, @publicKey, @counter, @transports)
`);
const stmtUpdateCounter = db.prepare("UPDATE credentials SET counter = ? WHERE id = ?");

// ── Public API ──────────────────────────────────────────────────

function rowToCredential(row: any): WebAuthnCredential {
  return {
    id: row.id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: row.transports ? row.transports.split(",") : undefined,
  };
}

export function getCredentials(username: string): WebAuthnCredential[] {
  return (stmtGetByUsername.all(username) as any[]).map(rowToCredential);
}

export function saveCredential(username: string, credential: WebAuthnCredential): void {
  stmtInsert.run({
    id: credential.id,
    username,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports?.join(",") ?? null,
  });
}

export function findCredential(
  username: string,
  credentialId: string,
): WebAuthnCredential | undefined {
  const row = stmtGetById.get(credentialId) as any;
  if (row && row.username === username) return rowToCredential(row);
}

export function persistCredentials(): void {
  // counter updates happen via updateCounter — no-op for full persist
}

export function updateCredentialCounter(credentialId: string, counter: number): void {
  stmtUpdateCounter.run(counter, credentialId);
}

// Challenge store — ephemeral
const challenges = new Map<string, string>();

export function saveChallenge(key: string, challenge: string): void {
  challenges.set(key, challenge);
}

export function consumeChallenge(key: string): string | undefined {
  const c = challenges.get(key);
  challenges.delete(key);
  return c;
}
