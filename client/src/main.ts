import "./style.css";
import { checkAuthenticatorStatus, registerPasskey, authenticateWithPasskey, authenticateDiscoverable } from "./passkey.js";
import { getCurrentUser, logout } from "./api.js";
import { getUsername, loadSavedUsername, setUsername, showMessage } from "./state.js";

function showLoggedOutUI(): void {
  document.getElementById("loginForm")!.style.display = "";
  document.getElementById("loggedInState")!.style.display = "none";
}

function showLoggedInUI(username: string): void {
  document.getElementById("loginForm")!.style.display = "none";
  document.getElementById("loggedInState")!.style.display = "";
  document.getElementById("loggedInUser")!.textContent = username;
}

// On page load: check session, platform authenticator, prefill saved username
(async () => {
  checkAuthenticatorStatus().then(() => {
    const saved = loadSavedUsername();
    if (saved) setUsername(saved);
  });

  try {
    const user = await getCurrentUser();
    showLoggedInUI(user.username);
  } catch {
    showLoggedOutUI();
  }
})();

// Primary login button — discoverable credential（无用户名，支持跨设备 QR 码）
document.getElementById("btnAuth")!.addEventListener("click", async () => {
  await authenticateDiscoverable();
  // After successful login, switch UI
  try {
    const user = await getCurrentUser();
    if (user.username) showLoggedInUI(user.username);
  } catch { /* stay on login form */ }
});

// Register button
document.getElementById("btnRegister")!.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) {
    showMessage("请先输入用户名", "info");
    return;
  }
  await registerPasskey(username);
  try {
    const user = await getCurrentUser();
    if (user.username) showLoggedInUI(user.username);
  } catch { /* stay on login form */ }
});

// Logout button
document.getElementById("btnLogout")!.addEventListener("click", async () => {
  await logout();
  showLoggedOutUI();
  showMessage("已登出", "info");
});

// Enter key — username-based login（有用户名时的精确匹配登录）
document.getElementById("username")!.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const username = getUsername();
    if (!username) {
      // 没输用户名就走 discoverable 流程
      document.getElementById("btnAuth")!.click();
      return;
    }
    authenticateWithPasskey(username).then(async () => {
      try {
        const user = await getCurrentUser();
        if (user.username) showLoggedInUI(user.username);
      } catch { /* stay on login form */ }
    });
  }
});
