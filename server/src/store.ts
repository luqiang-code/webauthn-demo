// 数据存储位置说明：
//   1. SQLite 数据库 → server/data/webauthn.db（持久化，存凭证公钥 + sessions）
//   2. 内存 Map     → challenges（临时，存 challenge，用完即删）
//   3. 浏览器端     → localStorage key="passkey-username"（存上次登录的用户名）
//   4. 操作系统级   → 指纹/Face ID/Touch ID/Windows Hello（存私钥，浏览器不暴露）

import type { WebAuthnCredential } from "@simplewebauthn/server";
import type { SessionData } from "express-session";
import { Store } from "express-session";
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

// sessions 表结构（SQLite 持久化 session，服务重启不丢失登录态）：
//   sid     → session ID（express-session 的 connect.sid cookie 值，主键）
//   sess    → session 数据（JSON 字符串）
//   expired → 过期时间（Unix 秒，用于查询过滤和定期清理）
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired INTEGER NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions (expired)`);

// ── Prepared statements ────────────────────────────────────────

const stmtGetByUsername = db.prepare("SELECT * FROM credentials WHERE username = ?");
const stmtGetById = db.prepare("SELECT * FROM credentials WHERE id = ?");
const stmtInsert = db.prepare(`
  INSERT INTO credentials (id, username, public_key, counter, transports)
  VALUES (@id, @username, @publicKey, @counter, @transports)
`);
const stmtUpdateCounter = db.prepare("UPDATE credentials SET counter = ? WHERE id = ?");

// Session prepared statements
const stmtSessGet = db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expired > ?");
const stmtSessSet = db.prepare(`
  INSERT INTO sessions (sid, sess, expired) VALUES (@sid, @sess, @expired)
  ON CONFLICT(sid) DO UPDATE SET sess = @sess, expired = @expired
`);
const stmtSessDestroy = db.prepare("DELETE FROM sessions WHERE sid = ?");
const stmtSessTouch = db.prepare("UPDATE sessions SET expired = ? WHERE sid = ?");
const stmtSessPrune = db.prepare("DELETE FROM sessions WHERE expired <= ?");

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

// 按凭据 ID 查找（无需用户名，用于 discoverable credential 流程）
export function findCredentialById(credentialId: string): (WebAuthnCredential & { username: string }) | undefined {
  const row = stmtGetById.get(credentialId) as any;
  if (row) return { ...rowToCredential(row), username: row.username };
}

export function persistCredentials(): void {
  // counter updates happen via updateCounter — no-op for full persist
}

export function updateCredentialCounter(credentialId: string, counter: number): void {
  stmtUpdateCounter.run(counter, credentialId);
}

// Challenge 存储（内存 Map，带 TTL）：
//   key     → username 或 discover（用于无用户名流程）
//   value   → { challenge: string, expiresAt: number (epoch ms) }
// 生命周期：saveChallenge 写入 → consumeChallenge 校验 TTL 后读取并删除（一次性使用）
// 过期挑战由 pruneChallenges 定期清理，服务重启后所有 challenge 丢失
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 分钟

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}

const challenges = new Map<string, ChallengeEntry>();

export function saveChallenge(key: string, challenge: string): void {
  challenges.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL });
}

export function consumeChallenge(key: string): string | undefined {
  const entry = challenges.get(key);
  challenges.delete(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) return undefined;
  return entry.challenge;
}

function pruneChallenges(): void {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of challenges) {
    if (now > entry.expiresAt) {
      challenges.delete(key);
      pruned++;
    }
  }
  if (pruned > 0) {
    console.log(`Pruned ${pruned} expired challenges`);
  }
}

// 每 5 分钟清理一次过期 challenge
setInterval(pruneChallenges, 5 * 60 * 1000);

// ── Session Store（SQLite 持久化）────────────────────────────────

export class SQLiteSessionStore extends Store {
  constructor() {
    super();
    // 每 5 分钟清理一次过期 session
    setInterval(() => this.prune(), 5 * 60 * 1000);
  }

  get(sid: string, callback: (err?: any, session?: SessionData | null) => void): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      const row = stmtSessGet.get(sid, now) as { sess: string } | undefined;
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expired = Math.floor((Date.now() + maxAge) / 1000);
      stmtSessSet.run({ sid, sess: JSON.stringify(session), expired });
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      stmtSessDestroy.run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expired = Math.floor((Date.now() + maxAge) / 1000);
      stmtSessTouch.run(expired, sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  private prune(): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = stmtSessPrune.run(now);
      if (result.changes > 0) {
        console.log(`Pruned ${result.changes} expired sessions`);
      }
    } catch { /* best effort */ }
  }
}
