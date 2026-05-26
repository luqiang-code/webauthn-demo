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
import { getCredentials, findCredential, saveChallenge, consumeChallenge } from "../store.js";

const router = Router();

const RP_ID = "localhost";
const ORIGIN = "http://localhost:5173";

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
    // Update counter to prevent replay
    credential.counter = verification.authenticationInfo.newCounter;
    console.log(`✓ Authenticated "${username}"`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

export default router;
