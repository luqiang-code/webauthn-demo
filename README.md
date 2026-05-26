# WebAuthn Passkey Demo

基于 [SimpleWebAuthn](https://simplewebauthn.dev) 的 WebAuthn 通行密钥（Passkey）演示项目，支持通过指纹/面容注册和登录。

## 项目结构

```
webauthn-demo/
├── package.json           # npm workspaces 根配置
├── tsconfig.base.json     # 共享 TypeScript 配置
├── shared/                # 前后端共享类型
│   └── src/types.ts       # API DTO、端点常量
├── server/                # 后端 — Express + SimpleWebAuthn
│   └── src/
│       ├── index.ts       # 入口
│       ├── store.ts       # 凭证存储层
│       └── routes/
│           ├── register.ts  # 注册 API
│           └── auth.ts      # 认证 API
└── client/                # 前端 — Vite + SimpleWebAuthn Browser
    ├── index.html         # 指纹优先 UI
    └── src/
        ├── main.ts        # 入口
        ├── api.ts         # API 客户端
        ├── passkey.ts     # 注册/认证业务逻辑
        ├── state.ts       # UI 状态管理
        └── errors.ts      # WebAuthn 错误处理
```

## 技术栈

- **后端**: Express + TypeScript + `@simplewebauthn/server`
- **前端**: Vite + TypeScript + `@simplewebauthn/browser`
- **共享**: `@webauthn-demo/shared` workspace 包

## 快速开始

```bash
# 安装依赖
npm install

# 同时启动后端 (3000) 和前端 (5173)
npm run dev
```

打开 http://localhost:5173，输入用户名即可注册或使用指纹登录。

## 工作流程

1. **注册**：输入用户名 → 点击「注册新设备」→ 系统弹出指纹/Face ID 提示 → 扫描指纹 → 注册成功
2. **登录**：输入用户名 → 点击「通过指纹登录」→ 指纹验证 → 登录成功
3. 刷新页面后用户名会自动预填（localStorage）

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register/options` | 获取注册参数 |
| POST | `/api/register/verify` | 验证注册响应 |
| POST | `/api/auth/options` | 获取认证参数 |
| POST | `/api/auth/verify` | 验证认证响应 |

## 注意事项

- 项目使用内存存储用户凭证，重启 server 后数据会丢失，生产环境请替换为数据库
- 前端通过 Vite 代理转发 `/api` 请求到后端，避免跨域问题
- `localhost` 环境下测试，部署到生产需修改 `RP_ID` 和 `ORIGIN`
