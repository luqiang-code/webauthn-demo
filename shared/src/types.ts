/// ── API 通用类型 —— 前后端共享的协议 ──────────────────────────

// 前后端共享的 API 协议类型
// 数据流向：
//   注册：浏览器 → POST /api/register/options → 拿 challenge
//                → 用户指纹/Face ID 签名 → POST /api/register/verify → 公钥存入 SQLite
//   认证：浏览器 → POST /api/auth/options → 拿 challenge
//                → 用户指纹/Face ID 签名 → POST /api/auth/verify → 验证签名 → 更新 counter
//   私钥始终在用户设备的安全区域，服务器只存公钥

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
