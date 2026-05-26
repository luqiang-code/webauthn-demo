import express from "express";
import registerRouter from "./routes/register.js";
import authRouter from "./routes/auth.js";

const app = express();
app.use(express.json());
app.use(express.static("../client"));

// ── API 路由 ──
app.use("/api/register", registerRouter);
app.use("/api/auth", authRouter);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
