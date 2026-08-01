import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import fs from "fs";
import cookieParser from "cookie-parser";

import { connect } from "./config/connectDB.js";
import userRouter from "./route/user.route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create upload directories (only if your app still uploads files)
const uploadDirs = ["uploads/lalpurjas", "uploads/temp"];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    message: "DMalpot running.",
  });
});

// API Routes
app.use("/api/user", userRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

// Global Error Handler (must be LAST)
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Start Server
const startServer = async () => {
  try {
    await connect();

    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database Connection Failure:", error.message);
    process.exit(1);
  }
};

startServer();