import express from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { WebAuthnCredential } from "@simplewebauthn/server";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// In-memory store (use a real DB in production)
const users = new Map<string, WebAuthnCredential[]>();

// RP config — origin must match where the page is served
const RP_NAME = "WebAuthn Demo";
const RP_ID = "localhost";
const ORIGIN = "http://localhost:3000";

// ── Register ──────────────────────────────────────────────────────

app.post("/register/options", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username required" });

  const existing = users.get(username) ?? [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    attestationType: "none",
    excludeCredentials: existing.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge temporarily for verification
  (req as any)._challenge = options.challenge;

  res.json(options);
});

app.post("/register/verify", async (req, res) => {
  const { username, registrationResponse } = req.body;
  const expectedChallenge = (req as any)._challenge;

  const verification = await verifyRegistrationResponse({
    response: registrationResponse,
    expectedChallenge: expectedChallenge ?? "",
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    const existing = users.get(username) ?? [];
    const newCred: WebAuthnCredential = {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: registrationResponse.response?.transports,
    };
    existing.push(newCred);
    users.set(username, existing);
    console.log(`✓ Registered credential for "${username}"`);
    return res.json({ verified: true });
  }

  res.status(400).json({ verified: false, error: "Verification failed" });
});

// ── Authenticate ───────────────────────────────────────────────────

app.post("/auth/options", async (req, res) => {
  const { username } = req.body;
  const credentials = users.get(username);

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials?.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    userVerification: "preferred",
  });

  (req as any)._challenge = options.challenge;

  res.json(options);
});

app.post("/auth/verify", async (req, res) => {
  const { username, authenticationResponse } = req.body;
  const expectedChallenge = (req as any)._challenge;

  const credentials = users.get(username);
  const credential = credentials?.find(
    (c) => c.id === authenticationResponse.id,
  );

  if (!credential) {
    return res.status(400).json({ error: "Credential not found" });
  }

  const verification = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge: expectedChallenge ?? "",
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
    console.log(`✓ Authenticated "${username}"`);
    return res.json({ verified: true });
  }

  res.status(400).json({ verified: false, error: "Verification failed" });
});

app.listen(3000, () => {
  console.log(`Server running at ${ORIGIN}`);
});
