// 认证流程数据流：
//   POST /options → 查 SQLite 是否有该用户的凭证 → 生成 challenge（存内存 Map）→ 返回
//   POST /verify  → 消费 challenge + 查 SQLite 取公钥验证签名 → 更新 counter 回 SQLite
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
import { getCredentials, findCredential, updateCredentialCounter, saveChallenge, consumeChallenge } from "../store.js";

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

  const verification = await verifyAuthenticationResponse({
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

  if (verification.verified) {
    // 更新 SQLite 中的 counter，防止签名重放
    // counter 是认证器内部单调递增的签名计数，每次签名 +1
    credential.counter = verification.authenticationInfo.newCounter;
    updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
    console.log(`✓ Authenticated "${username}"`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

export default router;
