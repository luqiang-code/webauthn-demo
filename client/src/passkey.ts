import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  browserSupportsWebAuthnAutofill,
} from "@simplewebauthn/browser";
import {
  getRegisterOptions,
  verifyRegistration,
  getAuthOptions,
  verifyAuthentication,
  ApiError,
} from "./api.js";
import {
  setLoading,
  setButtonsEnabled,
  showBiometricPrompt,
  hideBiometricPrompt,
  showMessage,
  clearMessage,
  setAuthenticatorStatus,
  saveUsername,
  showSuccess,
  showError,
} from "./state.js";
import { handleWebAuthnError } from "./errors.js";

export async function checkAuthenticatorStatus(): Promise<{
  platformAvailable: boolean;
  autofillSupported: boolean;
}> {
  const supported = browserSupportsWebAuthn();
  const platformAvailable = await platformAuthenticatorIsAvailable();
  const autofillSupported = await browserSupportsWebAuthnAutofill();

  if (supported && platformAvailable) {
    setAuthenticatorStatus(true);
  } else {
    setAuthenticatorStatus(false);
  }

  return { platformAvailable, autofillSupported };
}

export async function registerPasskey(username: string): Promise<void> {
  const btnRegister = document.getElementById("btnRegister") as HTMLButtonElement;

  setButtonsEnabled(false);
  setLoading(btnRegister, true);
  clearMessage();
  hideBiometricPrompt();

  try {
    const options = await getRegisterOptions(username);

    showBiometricPrompt();
    const regResp = await startRegistration({ optionsJSON: options as any });
    hideBiometricPrompt();

    const result = await verifyRegistration(username, regResp as any);

    if (result.verified) {
      saveUsername(username);
      showSuccess();
      showMessage("Passkey 注册成功！", "success");
    } else {
      showError();
      showMessage(result.error ?? "注册验证失败", "error");
    }
  } catch (err) {
    hideBiometricPrompt();
    showError();
    if (err instanceof ApiError) {
      showMessage(`服务器错误: ${err.message}`, "error");
    } else {
      showMessage(handleWebAuthnError(err), "error");
    }
  } finally {
    setLoading(btnRegister, false);
    setButtonsEnabled(true);
  }
}

export async function authenticateWithPasskey(username: string): Promise<void> {
  const btnAuth = document.getElementById("btnAuth") as HTMLButtonElement;

  setButtonsEnabled(false);
  setLoading(btnAuth, true);
  clearMessage();
  hideBiometricPrompt();

  try {
    const options = await getAuthOptions(username);

    showBiometricPrompt();
    const authResp = await startAuthentication({ optionsJSON: options as any });
    hideBiometricPrompt();

    const result = await verifyAuthentication(username, authResp as any);

    if (result.verified) {
      saveUsername(username);
      showSuccess();
      showMessage(`登录成功！欢迎回来 ${username}`, "success");
    } else {
      showError();
      showMessage(result.error ?? "登录验证失败", "error");
    }
  } catch (err) {
    hideBiometricPrompt();
    showError();
    if (err instanceof ApiError) {
      showMessage(`服务器错误: ${err.message}`, "error");
    } else {
      showMessage(handleWebAuthnError(err), "error");
    }
  } finally {
    setLoading(btnAuth, false);
    setButtonsEnabled(true);
  }
}
