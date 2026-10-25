
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "AlgoCanvas backend is running!",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "AlgoCanvas API is healthy",
  });
});

app.listen(PORT, () => {
  console.log(`AlgoCanvas backend running on port ${PORT}`);
});
