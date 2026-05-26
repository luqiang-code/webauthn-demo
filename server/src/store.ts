import type { WebAuthnCredential } from "@simplewebauthn/server";

// In-memory credential store (use a real DB in production)
const users = new Map<string, WebAuthnCredential[]>();

export function getCredentials(username: string): WebAuthnCredential[] {
  return users.get(username) ?? [];
}

export function saveCredential(
  username: string,
  credential: WebAuthnCredential,
): void {
  const existing = users.get(username) ?? [];
  existing.push(credential);
  users.set(username, existing);
}

export function findCredential(
  username: string,
  credentialId: string,
): WebAuthnCredential | undefined {
  return users.get(username)?.find((c) => c.id === credentialId);
}
