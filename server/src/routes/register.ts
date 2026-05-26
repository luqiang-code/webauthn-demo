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
const RP_ID = "localhost";
const ORIGIN = "http://localhost:3000";

// POST /api/register/options
router.post("/options", async (req, res) => {
  const { username } = req.body as RegisterOptionsRequest;
  if (!username) return res.status(400).json({ error: "username required" });

  const existing = getCredentials(username);

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

  // Persist challenge so verify can consume it
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
    const newCred: WebAuthnCredential = {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: (registrationResponse as any).response?.transports,
    };
    saveCredential(username, newCred);
    console.log(`✓ Registered credential for "${username}"`);
    return res.json({ verified: true } satisfies VerifyResponse);
  }

  res
    .status(400)
    .json({ verified: false, error: "Verification failed" } satisfies VerifyResponse);
});

export default router;
