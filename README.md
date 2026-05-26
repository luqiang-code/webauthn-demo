# WebAuthn Passkey Demo

基于 [SimpleWebAuthn](https://simplewebauthn.dev) 的 WebAuthn 通行密钥（Passkey）演示项目，支持注册和登录。

## 技术栈

- **后端**: Express + TypeScript + `@simplewebauthn/server`
- **前端**: 原生 HTML/JS + `@simplewebauthn/browser`（ESM CDN）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000，输入用户名后即可注册或使用 Passkey 登录。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register/options` | 获取注册参数 |
| POST | `/register/verify` | 验证注册响应 |
| POST | `/auth/options` | 获取认证参数 |
| POST | `/auth/verify` | 验证认证响应 |

## 注意事项

- 项目使用内存存储用户凭证，重启后数据会丢失，生产环境请替换为数据库
- `localhost` 环境下测试，部署到生产需修改 `RP_ID` 和 `ORIGIN`
