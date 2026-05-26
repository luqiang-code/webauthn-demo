// Express 服务端入口（端口 3000）
// 部署架构（开发环境）：
//   浏览器 :5173 → Vite dev server → proxy /api → localhost:3000
//   数据存储：server/data/webauthn.db（SQLite，持久化凭证）
//   Session：express-session（内存，24h 过期）

import express from "express";
import session from "express-session";
import cors from "cors";
import { SQLiteSessionStore } from "./store.js";
import registerRoutes from "./routes/register";
import authRoutes from "./routes/auth";

const app = express();
app.use(express.json());

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 小时
const SESSION_SECRET = process.env.SESSION_SECRET ?? "webauthn-demo-dev-secret";

app.use(session({
  store: new SQLiteSessionStore(),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
}));

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use("/api/register", registerRoutes);
app.use("/api/auth", authRoutes);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
