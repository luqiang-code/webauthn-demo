// 注册流程数据流：
//   POST /options → 生成 challenge（存内存 Map）→ 返回给浏览器
//   POST /verify  → 消费 challenge + 验证签名 → 凭证公钥存入 SQLite → 签发 session（自动登录）
//   私钥始终在用户设备（Touch ID/Windows Hello/安全密钥），从不离开浏览器

import { Router } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { WebAuthnCredential } from "@simplewebauthn/server";
import type {
  RegisterOptionsRequest,
  RegisterVerifyRequest,
  RegisterOptionsResponse,
  VerifyResponse,
} from "@webauthn-demo/shared";
import { getCredentials, saveCredential, saveChallenge, consumeChallenge } from "../store.js";

const router = Router();

const RP_NAME = "WebAuthn Demo";
const RP_ID = process.env.RP_ID ?? "localhost";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";

// POST /api/register/options
router.post("/options", async (req, res) => {
  const { username } = req.body as RegisterOptionsRequest;
  if (!username) return res.status(400).json({ error: "username required" });

  const existing = getCredentials(username);

  // 用户名唯一性检查：
  // - 未登录状态：禁止注册已被占用的用户名
  // - 已登录状态：仅允许该用户给自己添加更多 passkey
  if (existing.length > 0 && req.session.username !== username) {
    return res.status(409).json({ error: "该用户名已被注册" });
  }

  const options = (await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    attestationType: "none",
    excludeCredentials: existing.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  })) as unknown as RegisterOptionsResponse;

  // challenge 暂存内存 Map（key=username），/verify 时取出并删除
  saveChallenge(username, options.challenge);

  res.json(options);
});

// POST /api/register/verify
router.post("/verify", async (req, res) => {
  const { username, registrationResponse } = req.body as RegisterVerifyRequest;

  const expectedChallenge = consumeChallenge(username);
  if (!expectedChallenge) {
    return res.status(400).json({ error: "Challenge expired or missing" });
  }

  const verification = await verifyRegistrationResponse({
    response: registrationResponse as any,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    // 凭证公钥存入 SQLite server/data/webauthn.db（credentials 表）
    // 私钥由浏览器交给操作系统安全区域（Touch ID/Face ID/安全密钥），服务器不可见
    const newCred: WebAuthnCredential = {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: (registrationResponse as any).response?.transports,
    };
    saveCredential(username, newCred);
    // 注册成功后自动登录
    req.session.username = username;
    console.log(`✓ Registered credential for "${username}" (session created)`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

export default router;
