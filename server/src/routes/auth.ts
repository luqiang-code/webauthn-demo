// 认证流程数据流：
//   POST /options         → 查 SQLite 是否有该用户的凭证 → 生成 challenge → 返回
//   POST /verify          → 消费 challenge + 查 SQLite 取公钥验证签名 → 更新 counter → 签发 session
//   POST /discover        → 无用户名生成 challenge（discoverable credential）→ 返回，挑战存 session
//   POST /discover/verify → 从 userHandle 解码用户名 + 验证签名 → 更新 counter → 签发 session
//   GET  /me               → 返回当前 session 中的用户信息
//   POST /logout           → 销毁 session
//   私钥签名在用户设备本地完成，服务器只验证签名，不接触私钥

import { Router } from "express";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthOptionsRequest,
  AuthVerifyRequest,
  AuthOptionsResponse,
  VerifyResponse,
} from "@webauthn-demo/shared";
import { getCredentials, findCredential, findCredentialById, updateCredentialCounter, saveChallenge, consumeChallenge } from "../store.js";
import { decodeUserHandle } from "../user-handle.js";

const router = Router();

const RP_ID = process.env.RP_ID ?? "localhost";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";

// POST /api/auth/options
router.post("/options", async (req, res) => {
  const { username } = req.body as AuthOptionsRequest;
  const credentials = getCredentials(username);

  if (credentials.length === 0) {
    return res.status(400).json({ error: "该用户未注册 Passkey，请先注册" });
  }

  const options = (await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    userVerification: "required",
  })) as unknown as AuthOptionsResponse;

  // Persist challenge so verify can consume it
  saveChallenge(username, options.challenge);

  res.json(options);
});

// POST /api/auth/verify
router.post("/verify", async (req, res) => {
  const { username, authenticationResponse } = req.body as AuthVerifyRequest;

  const expectedChallenge = consumeChallenge(username);
  if (!expectedChallenge) {
    return res.status(400).json({ error: "Challenge expired or missing" });
  }

  const credential = findCredential(username, authenticationResponse.id as string);
  if (!credential) {
    return res.status(400).json({ error: "Credential not found" });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authenticationResponse as any,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      },
    });
  } catch (err) {
    console.error("Authentication verification error:", err);
    return res.status(400).json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
  }

  if (verification.verified) {
    // 更新 SQLite 中的 counter，防止签名重放
    // counter 是认证器内部单调递增的签名计数，每次签名 +1
    updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);

    // 签发 session，标记用户已登录
    req.session.username = username;

    console.log(`✓ Authenticated "${username}" (session created)`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

// GET /api/auth/me — 检查当前 session 是否已登录
router.get("/me", (req, res) => {
  if (req.session.username) {
    return res.json({ username: req.session.username });
  }
  res.status(401).json({ error: "Not authenticated" });
});

// POST /api/auth/logout — 销毁 session
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// POST /api/auth/discover — 无用户名登录（discoverable credential）
// 不传 allowCredentials，浏览器会弹出 passkey 选择器
// 本地有 passkey → 直接指纹/面容验证；没有 → 显示二维码供手机扫描
router.post("/discover", async (req, res) => {
  const options = (await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  })) as unknown as AuthOptionsResponse;

  // 挑战存 session，跨设备 QR 流程中同一桌面浏览器持有相同 cookie
  req.session.discoverChallenge = options.challenge;

  res.json(options);
});

// POST /api/auth/discover/verify — 验证 discoverable credential 签名
router.post("/discover/verify", async (req, res) => {
  const { authenticationResponse } = req.body as { authenticationResponse: Record<string, unknown> };

  const expectedChallenge = req.session.discoverChallenge;
  if (!expectedChallenge) {
    return res.status(400).json({ error: "Challenge expired or missing" });
  }
  delete req.session.discoverChallenge;

  const credentialId = authenticationResponse.id as string;

  // 按凭据 ID 查找公钥（discoverable 流程没有用户名，只能按 ID 查）
  const credential = findCredentialById(credentialId);
  if (!credential) {
    return res.status(400).json({ error: "该凭据未注册，请先注册 Passkey" });
  }

  // userHandle 优先用于确定用户名（新注册的凭据已编码用户名）
  // 旧凭据的 userHandle 是随机值，解码失败时回退使用凭据记录的 username
  const userHandle = (authenticationResponse as any).response?.userHandle;
  const decoded = decodeUserHandle(userHandle);
  const username = (decoded && decoded === credential.username) ? decoded : credential.username;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authenticationResponse as any,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      },
    });
  } catch (err) {
    console.error("Discover authentication verification error:", err);
    return res.status(400).json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
  }

  if (verification.verified) {
    updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);

    // 签发 session，标记用户已登录
    req.session.username = username;

    console.log(`✓ Authenticated "${username}" via discoverable credential (session created)`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

export default router;
