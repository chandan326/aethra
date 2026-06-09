require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const seedDatabase = require("./utils/seeder");

const authRoutes = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());



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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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

async function startServer(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log("✅ Connected to MongoDB");
    await seedDatabase();
  } catch (error) {
    console.error("MongoDB connection error:", error.message || error);
    if (atlasUri && uri === atlasUri && localUri) {
      console.log("Attempting local MongoDB fallback...");
      await startServer(localUri);
      return;
    }
    console.log("⚠️ Running in offline mock-database mode. Static preview will still function.");
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

startServer(initialUri);