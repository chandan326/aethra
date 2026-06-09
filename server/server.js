require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const seedDatabase = require("./utils/seeder");

const authRoutes = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Secure HTTP Headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Restrict access to sensitive configurations, backups, scripts, and logs
app.use((req, res, next) => {
  const file = path.basename(req.path).toLowerCase();
  if (
    file.endsWith(".zip") ||
    file.endsWith(".rar") ||
    file.endsWith(".tar") ||
    file.endsWith(".gz") ||
    file.endsWith(".pdf") ||
    file === "dockerfile" ||
    file.endsWith(".yml") ||
    file.endsWith(".yaml") ||
    file.endsWith(".env") ||
    file.endsWith(".json") ||
    file.startsWith(".git")
  ) {
    return res.status(403).json({ message: "Access forbidden" });
  }
  next();
});

// Routes import
const postRoutes = require("./routes/posts");
const channelRoutes = require("./routes/channels");
const chatRoutes = require("./routes/chat");
const supportRoutes = require("./routes/support");

// Mount APIs
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/support", supportRoutes);

// Static folders
const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
const uploadDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "../")));

// SPA Fallback: Serve index.html for any unhandled client-side routes
app.get(/.*/, (req, res, next) => {
  // If requesting api, let it pass to 404 handler
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Disable command buffering so database requests fail instantly when offline
mongoose.set("bufferCommands", false);

const port = process.env.PORT || 5000;
const atlasUri = process.env.MONGO_URI;
const localUri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/aethra";
const initialUri = atlasUri || localUri;

// Middleware to ensure database connection is active before processing requests
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  try {
    await mongoose.connect(initialUri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ Connected/Reconnected to MongoDB via middleware");
    next();
  } catch (error) {
    console.error("⚠️ Database connection failed in middleware:", error.message || error);
    // Continue so that offline mock fallback logic can trigger in routes if DB is offline
    next();
  }
});

async function startServer(uri) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log("✅ Connected to MongoDB");
      await seedDatabase();
    }
  } catch (error) {
    console.error("MongoDB connection error during startup:", error.message || error);
    if (atlasUri && uri === atlasUri && localUri) {
      console.log("Attempting local MongoDB fallback...");
      await startServer(localUri);
      return;
    }
    console.log("⚠️ Running in offline mock-database mode. Static preview will still function.");
  }
}

// Print security warnings during startup
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("🚨 WARNING: JWT_SECRET environment variable is not set! Using default developer key. This is a severe security risk in production.");
}

// Initial connection attempt on startup
startServer(initialUri);

// Start server if run directly (e.g. node server.js) rather than through Vercel serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

module.exports = app;