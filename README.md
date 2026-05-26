# WebAuthn Passkey Demo

基于 [SimpleWebAuthn](https://simplewebauthn.dev) 的 WebAuthn 通行密钥（Passkey）演示项目，支持指纹/面容注册、一键登录和跨设备扫码认证。

## 功能

- **Passkey 注册** — 指纹/面容创建通行密钥
- **无用户名登录** — 一键唤起浏览器 passkey 选择器，无需输入用户名
- **跨设备认证** — 桌面端扫码，手机端验证，通过 BLE 完成登录
- **多设备支持** — 已登录用户可为同一账号追加注册多个 passkey
- **会话持久化** — SQLite 存储 session，服务重启不丢失登录态
- **用户名唯一性** — 防止账号抢注

## 项目结构

```
webauthn-demo/
├── package.json           # npm workspaces 根配置
├── tsconfig.base.json     # 共享 TypeScript 配置
├── shared/                # 前后端共享类型
│   └── src/types.ts       # API DTO、端点常量
├── server/                # 后端 — Express + SimpleWebAuthn + SQLite
│   ├── data/              # SQLite 数据库文件（webauthn.db）
│   └── src/
│       ├── index.ts       # 入口（Express + session 中间件）
│       ├── store.ts       # 数据存储层（credentials + sessions）
│       ├── session.d.ts   # Session 类型扩展
│       ├── user-handle.ts # 用户标识编解码
│       └── routes/
│           ├── register.ts  # 注册 API
│           └── auth.ts      # 认证 + 发现式登录 API
└── client/                # 前端 — Vite + SimpleWebAuthn Browser
    ├── index.html         # Passkey 优先 UI
    └── src/
        ├── main.ts        # 入口
        ├── api.ts         # API 客户端
        ├── passkey.ts     # 注册/认证业务逻辑
        ├── state.ts       # UI 状态管理
        └── errors.ts      # WebAuthn 错误处理
```

## 技术栈

- **后端**: Express + TypeScript + `@simplewebauthn/server` + `better-sqlite3` + `express-session`
- **前端**: Vite + TypeScript + `@simplewebauthn/browser`
- **共享**: `@webauthn-demo/shared` workspace 包
- **隧道**: ngrok（为 WebAuthn 提供 HTTPS 安全上下文）

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（HTTP，仅 localhost 可用）
npm run dev

# 生产部署（需 HTTPS — 使用 ngrok 隧道）
npm run tunnel
```

打开 `http://localhost:5173`（本地）或 ngrok 提供的 HTTPS 地址。

## 工作流程

**注册**
1. 输入用户名 → 点击「注册新设备」
2. 浏览器弹出 passkey 创建对话框（指纹/Face ID/PIN）
3. 如需在手机注册 → 选择「其他设备」→ 扫描二维码
4. 注册成功，自动登录

**登录（无用户名 / discoverable）**
1. 点击「通过指纹登录」
2. 浏览器弹出 passkey 选择器
3. 本机有 passkey → 直接指纹/面容验证
4. 本机没有 → 显示二维码 → 手机扫描 → 手机验证 → 桌面端登录

**登录（有用户名）**
1. 输入用户名 → 按 Enter
2. 浏览器验证对应账号的 passkey

**追加 passkey**
1. 先登录已有账号
2. 输入同一用户名 → 点击「注册新设备」
3. 在另一台设备上注册 passkey

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register/options` | 获取注册参数（含用户名唯一性检查） |
| POST | `/api/register/verify` | 验证注册响应，成功后自动登录 |
| POST | `/api/auth/options` | 获取认证参数（需用户名） |
| POST | `/api/auth/verify` | 验证认证响应，成功后签发 session |
| POST | `/api/auth/discover` | 获取无用户名认证参数（discoverable credential） |
| POST | `/api/auth/discover/verify` | 验证发现式凭据，从 userHandle 解码用户名 |
| GET  | `/api/auth/me` | 检查当前 session 登录状态 |
| POST | `/api/auth/logout` | 销毁 session |

## 数据存储

| 存储位置 | 内容 | 生命周期 |
|----------|------|----------|
| SQLite `credentials` 表 | 凭据公钥、counter、传输方式 | 持久化 |
| SQLite `sessions` 表 | 用户 session | 持久化（24h 过期，5 分钟清理一次） |
| 内存 `Map` | challenge | 一次性使用，用完即删 |
| 浏览器 `localStorage` | 上次登录用户名 | 持久化 |
| 操作系统安全区域 | 私钥 | 由 Touch ID/Face ID 管理，JS 不可访问 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RP_ID` | `localhost` | WebAuthn Relying Party ID（ngrok 域名） |
| `ORIGIN` | `http://localhost:5173` | 允许的来源 |
| `SESSION_SECRET` | `webauthn-demo-dev-secret` | Session 加密密钥（生产环境必须修改） |

## 注意事项

- WebAuthn 要求安全上下文（HTTPS 或 localhost），部署需配置 HTTPS 或使用 ngrok
- 前端通过 Vite 代理转发 `/api` 请求到后端，避免跨域问题
- 生产环境请修改 `SESSION_SECRET` 环境变量
- 手机扫描二维码需要蓝牙开启，且双方在同一局域网或通过 BLE 通信
