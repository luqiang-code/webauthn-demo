import {
  type RegisterOptionsResponse,
  type AuthOptionsResponse,
  type VerifyResponse,
  type RegisterOptionsRequest,
  type RegisterVerifyRequest,
  type AuthOptionsRequest,
  type AuthVerifyRequest,
} from "@webauthn-demo/shared";

const BASE = "http://localhost:3000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getRegisterOptions(
  username: string,
): Promise<RegisterOptionsResponse> {
  return post<RegisterOptionsResponse>("/api/register/options", {
    username,
  } satisfies RegisterOptionsRequest);
}

export async function verifyRegistration(
  username: string,
  registrationResponse: Record<string, unknown>,
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/api/register/verify", {
    username,
    registrationResponse,
  } satisfies RegisterVerifyRequest);
}

export async function getAuthOptions(
  username: string,
): Promise<AuthOptionsResponse> {
  return post<AuthOptionsResponse>("/api/auth/options", {
    username,
  } satisfies AuthOptionsRequest);
}

export async function verifyAuthentication(
  username: string,
  authenticationResponse: Record<string, unknown>,
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/api/auth/verify", {
    username,
    authenticationResponse,
  } satisfies AuthVerifyRequest);
}
