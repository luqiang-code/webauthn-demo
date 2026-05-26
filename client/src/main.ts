import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  getRegisterOptions,
  verifyRegistration,
  getAuthOptions,
  verifyAuthentication,
} from "./api.js";

const $ = (id: string) => document.getElementById(id)!;

function showMsg(text: string, ok: boolean) {
  const el = $("msg");
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
}

function getUsername(): string | null {
  const v = ($("username") as HTMLInputElement).value.trim();
  if (!v) {
    showMsg("请先输入用户名", false);
    return null;
  }
  return v;
}

// ── Register ──────────────────────────────────────────────

($("btnRegister") as HTMLButtonElement).onclick = async () => {
  const username = getUsername();
  if (!username) return;

  const btn = $("btnRegister") as HTMLButtonElement;
  btn.disabled = true;
  showMsg("", false);

  try {
    const options = await getRegisterOptions(username);
    // JSON round-trip ensures runtime types match WebAuthn API expectations
    const regResp = await startRegistration({ optionsJSON: options as any });
    const result = await verifyRegistration(username, regResp as any);

    if (result.verified) {
      showMsg("Passkey 注册成功！", true);
    } else {
      showMsg("注册验证失败: " + (result.error || "未知错误"), false);
    }
  } catch (e: any) {
    showMsg("注册出错: " + e.message, false);
  } finally {
    btn.disabled = false;
  }
};

// ── Authenticate ──────────────────────────────────────────

($("btnAuth") as HTMLButtonElement).onclick = async () => {
  const username = getUsername();
  if (!username) return;

  const btn = $("btnAuth") as HTMLButtonElement;
  btn.disabled = true;
  showMsg("", false);

  try {
    const options = await getAuthOptions(username);
    const authResp = await startAuthentication({ optionsJSON: options as any });
    const result = await verifyAuthentication(username, authResp as any);

    if (result.verified) {
      showMsg("登录成功！", true);
    } else {
      showMsg("登录验证失败: " + (result.error || "未知错误"), false);
    }
  } catch (e: any) {
    showMsg("登录出错: " + e.message, false);
  } finally {
    btn.disabled = false;
  }
};
