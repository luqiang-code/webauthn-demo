/// ── API 通用类型 —— 前后端共享的协议 ──────────────────────────

// ── Request DTOs ──

export interface RegisterOptionsRequest {
  username: string;
}

export interface RegisterVerifyRequest {
  username: string;
  registrationResponse: Record<string, unknown>;
}

export interface AuthOptionsRequest {
  username: string;
}

export interface AuthVerifyRequest {
  username: string;
  authenticationResponse: Record<string, unknown>;
}

// ── Response DTOs ──

export interface RegisterOptionsResponse {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: string; alg: number }[];
  timeout: number;
  attestation: string;
  excludeCredentials: { id: string; type: string; transports?: string[] }[];
  authenticatorSelection: {
    residentKey: string;
    userVerification: string;
  };
}

export interface AuthOptionsResponse {
  challenge: string;
  rpId: string;
  allowCredentials?: { id: string; type: string; transports?: string[] }[];
  timeout: number;
  userVerification: string;
}

export interface VerifyResponse {
  verified: boolean;
  error?: string;
}

// ── API 端点汇总 —— 所有端点信息一处查 ──

export const API = {
  REGISTER_OPTIONS: "POST /api/register/options",
  REGISTER_VERIFY:  "POST /api/register/verify",
  AUTH_OPTIONS:     "POST /api/auth/options",
  AUTH_VERIFY:      "POST /api/auth/verify",
} as const;
