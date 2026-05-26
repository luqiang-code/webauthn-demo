// 数据存储位置说明：
//   1. SQLite 数据库 → server/data/webauthn.db（持久化，存凭证公钥）
//   2. 内存 Map     → challenges（临时，存 challenge，用完即删）
//   3. 浏览器端     → localStorage key="passkey-username"（存上次登录的用户名）
//   4. 操作系统级   → 指纹/Face ID/Touch ID/Windows Hello（存私钥，浏览器不暴露）

import type { WebAuthnCredential } from "@simplewebauthn/server";
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// SQLite 数据库文件：server/data/webauthn.db
// 存 WebAuthn 凭证（公钥、counter、transport），服务重启不丢失
const db = new Database(join(DATA_DIR, "webauthn.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// credentials 表结构（存入 SQLite，持久化）：
//   id          → 凭证 ID（WebAuthn 生成，Base64URL 字符串，主键）
//   username    → 用户名（用于查询某用户的所有凭证，有索引）
//   public_key  → 公钥（二进制 BLOB，用于服务端验证签名）
//   counter     → 签名计数器（每次认证 +1，防重放攻击）
//   transports  → 传输方式（逗号分隔，如 "internal,hybrid"，可选）
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

// Challenge 存储（内存 Map，临时）：
//   key   → username
//   value → challenge 字符串（服务端随机生成，客户端需签名后返回）
// 生命周期：saveChallenge 写入 → consumeChallenge 读取并删除（一次性使用）
// 服务重启后所有 challenge 丢失，用户需重新发起认证
const challenges = new Map<string, string>();

export function saveChallenge(key: string, challenge: string): void {
  challenges.set(key, challenge);
}

export function consumeChallenge(key: string): string | undefined {
  const c = challenges.get(key);
  challenges.delete(key);
  return c;
}
