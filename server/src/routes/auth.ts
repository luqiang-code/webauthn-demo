import { Router } from "express";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { getCredentials, findCredential } from "../store";

const router = Router();

const RP_ID = "localhost";
const ORIGIN = "http://localhost:3000";

router.post("/options", async (req, res) => {
  const { username } = req.body;
  const credentials = getCredentials(username);

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    userVerification: "preferred",
  });

  (req as any)._challenge = options.challenge;

  res.json(options);
});

router.post("/verify", async (req, res) => {
  const { username, authenticationResponse } = req.body;
  const expectedChallenge = (req as any)._challenge;

  const credential = findCredential(username, authenticationResponse.id);

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

export default router;
