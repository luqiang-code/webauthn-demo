import "./style.css";
import { checkAuthenticatorStatus, registerPasskey, authenticateWithPasskey } from "./passkey.js";
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

// Bind buttons — login
document.getElementById("btnAuth")!.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) {
    showMessage("请先输入用户名", "info");
    return;
  }
  await authenticateWithPasskey(username);
  // After successful login, switch UI
  try {
    const user = await getCurrentUser();
    if (user.username) showLoggedInUI(user.username);
  } catch { /* stay on login form */ }
});

// Bind buttons — register
document.getElementById("btnRegister")!.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) {
    showMessage("请先输入用户名", "info");
    return;
  }
  await registerPasskey(username);
  // After successful registration (auto-login), switch UI
  try {
    const user = await getCurrentUser();
    if (user.username) showLoggedInUI(user.username);
  } catch { /* stay on login form */ }
});

// Bind buttons — logout
document.getElementById("btnLogout")!.addEventListener("click", async () => {
  await logout();
  showLoggedOutUI();
  showMessage("已登出", "info");
});

// Enter key triggers login
document.getElementById("username")!.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("btnAuth")!.click();
  }
});
