import "./style.css";
import { checkAuthenticatorStatus, registerPasskey, authenticateWithPasskey } from "./passkey.js";
import { getUsername, loadSavedUsername, setUsername, showMessage } from "./state.js";

// On page load: check platform authenticator, prefill saved username
checkAuthenticatorStatus().then(() => {
  const saved = loadSavedUsername();
  if (saved) setUsername(saved);
});

// Bind buttons
document.getElementById("btnAuth")!.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) {
    showMessage("请先输入用户名", "info");
    return;
  }
  await authenticateWithPasskey(username);
});

document.getElementById("btnRegister")!.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) {
    showMessage("请先输入用户名", "info");
    return;
  }
  await registerPasskey(username);
});

// Enter key triggers login
document.getElementById("username")!.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("btnAuth")!.click();
  }
});
