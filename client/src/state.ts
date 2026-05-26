// 客户端存储位置：
//   localStorage key="passkey-username" → 上次成功登录/注册的用户名
//   DOM 元素 state（内存）            → UI 状态（loading、消息、按钮状态）
//   凭证私钥                          → 操作系统级（Touch ID/Windows Hello），JS 无法访问

// DOM cache
const card = document.getElementById("app")!;
const fingerprintSpinner = document.getElementById("fingerprintSpinner")!;
const statusBar = document.getElementById("statusBar")!;
const statusText = document.getElementById("statusText")!;
const msgEl = document.getElementById("msg")!;
const msgText = document.getElementById("msgText")!;
const btnAuth = document.getElementById("btnAuth") as HTMLButtonElement;
const btnRegister = document.getElementById("btnRegister") as HTMLButtonElement;
const usernameInput = document.getElementById("username") as HTMLInputElement;

// ── Loading state ────────────────────────────────────────────

export function setLoading(btn: HTMLButtonElement, loading: boolean): void {
  if (loading) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

export function setButtonsEnabled(enabled: boolean): void {
  btnAuth.disabled = !enabled;
  btnRegister.disabled = !enabled;
  usernameInput.disabled = !enabled;
}

// ── Biometric prompt ─────────────────────────────────────────

export function showBiometricPrompt(): void {
  card.classList.add("biometric");
  fingerprintSpinner.style.display = "block";
}

export function hideBiometricPrompt(): void {
  card.classList.remove("biometric", "success", "error");
  fingerprintSpinner.style.display = "none";
}

// ── Message ──────────────────────────────────────────────────

export function showMessage(text: string, type: "success" | "error" | "info"): void {
  msgText.textContent = text;
  msgEl.className = `msg show ${type}`;
}

export function clearMessage(): void {
  msgEl.className = "msg";
}

// ── Status bar ───────────────────────────────────────────────

export function setAuthenticatorStatus(available: boolean): void {
  statusBar.style.display = "flex";
  if (available) {
    statusBar.classList.add("available");
    statusText.textContent = "已检测到安全密钥";
  } else {
    statusBar.classList.remove("available");
    statusText.textContent = "未检测到安全密钥";
  }
}

// ── Username（localStorage 持久化） ─────────────────────────────

export function getUsername(): string {
  return usernameInput.value.trim();
}

export function setUsername(value: string): void {
  usernameInput.value = value;
}

// 存入浏览器 localStorage，key="passkey-username"
// 下次打开页面自动预填，避免重复输入
export function saveUsername(username: string): void {
  try { localStorage.setItem("passkey-username", username); } catch { /* quota exceeded */ }
}

export function loadSavedUsername(): string | null {
  try { return localStorage.getItem("passkey-username"); } catch { return null; }
}

// ── Success indicator ────────────────────────────────────────

export function showSuccess(): void {
  card.classList.add("success");
}

export function showError(): void {
  card.classList.add("error");
}
