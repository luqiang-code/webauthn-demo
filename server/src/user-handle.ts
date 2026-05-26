// UserHandle 编解码：
//   注册时把 username 编码为 userID，存入 passkey
//   无用户名登录时从 auth 响应中解码 userHandle 得到 username

import { Buffer } from "node:buffer";

export function encodeUserHandle(username: string): Uint8Array {
  return Buffer.from(username, "utf-8");
}

export function decodeUserHandle(userHandle: Uint8Array | Buffer | undefined | null): string | undefined {
  if (!userHandle || userHandle.length === 0) return undefined;
  return Buffer.from(userHandle).toString("utf-8");
}
