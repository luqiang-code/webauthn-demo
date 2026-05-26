import express from "express";
import cors from "cors";
import registerRoutes from "./routes/register";
import authRoutes from "./routes/auth";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

app.use("/api/register", registerRoutes);
app.use("/api/auth", authRoutes);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
