import type {
  RegisterOptionsResponse,
  AuthOptionsResponse,
  VerifyResponse,
  RegisterOptionsRequest,
  RegisterVerifyRequest,
  AuthOptionsRequest,
  AuthVerifyRequest,
} from "@webauthn-demo/shared";

const BASE = "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let message = `Server error (${res.status})`;
    if (contentType.includes("application/json")) {
      const data = await res.json();
      message = (data as any)?.error ?? message;
    }
    throw new ApiError(res.status, message);
  }

  if (!contentType.includes("application/json")) {
    throw new ApiError(res.status, "服务器返回了非预期的响应，请检查服务是否正常运行");
  }

  return res.json() as Promise<T>;
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

export async function getCurrentUser(): Promise<{ username: string }> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
    if (res.status === 401) throw new ApiError(401, "Not authenticated");
    throw new ApiError(res.status, `Server error (${res.status})`);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, "Logout failed");
}

// ── Discoverable credential（无用户名登录）──────────────────────

export async function getDiscoverOptions(): Promise<AuthOptionsResponse> {
  return post<AuthOptionsResponse>("/api/auth/discover", {});
}

export async function verifyDiscover(
  authenticationResponse: Record<string, unknown>,
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/api/auth/discover/verify", {
    authenticationResponse,
  });
}
