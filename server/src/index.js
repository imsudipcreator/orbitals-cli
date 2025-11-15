import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { auth } from "./lib/auth.js";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000", // frontend's origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);

app.all("/api/auth/*splat", toNodeHandler(auth)); // For ExpressJS v5

app.use(express.json());

app.get("/health", (req, res) => {
  res.send("ok");
});

app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return res.json(session);
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port http://localhost:${process.env.PORT}`);
});
