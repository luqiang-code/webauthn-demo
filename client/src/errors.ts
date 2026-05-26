import { WebAuthnError } from "@simplewebauthn/browser";

export function handleWebAuthnError(error: unknown): string {
  if (error instanceof WebAuthnError) {
    switch (error.code) {
      case "ERROR_CEREMONY_ABORTED":
        return "验证已取消";
      case "ERROR_AUTHENTICATOR_GENERAL_ERROR":
        return "安全密钥错误，请重试";
      case "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT":
        return "您的设备不支持指纹/面容验证，请使用安全密钥";
      case "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY":
        return `验证失败: ${(error as any).cause?.message ?? error.message}`;
      default:
        return `安全密钥错误: ${error.message}`;
    }
  }

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "指纹/面容验证被拒绝，请重试";
    if (error.name === "AbortError") return "验证已取消";
    if (error.name === "TimeoutError") return "操作超时，请重试";
    if (error.name === "NotSupportedError") return "浏览器不支持此功能";
  }

  if (error instanceof Error) {
    if (error.message?.includes("timed out")) return "操作超时，请检查网络连接";
    if (error.name === "TypeError") return "浏览器不支持此功能，请使用最新版浏览器";
    return `验证失败: ${error.message}`;
  }

  return "发生未知错误，请重试";
}
