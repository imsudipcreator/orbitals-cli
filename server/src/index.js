import dotenv from "dotenv";
import express from "express";

dotenv.config();
const app = express();

app.get("/health", (req, res) => {
  res.send("ok");
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port http://localhost:${process.env.PORT}`);
});
