require("dotenv").config();
const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
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

// Dynamic SPA Fallback: Serve index.html with dynamically injected Open Graph meta tags
// Matches any path that doesn't have a file extension (no dot) and is not an API/uploads route
app.get(/.*/, async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.includes(".")) {
    return next();
  }

  const indexPath = path.join(__dirname, "../index.html");
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send("index.html not found");
  }

  try {
    let html = fs.readFileSync(indexPath, "utf8");

    // Default metadata values
    let title = "Aethra — Create. Inspire. Belong.";
    let description = "Discover and share premium digital art, gifs, and stickers on Aethra.";
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    let imageUrl = `${hostUrl}/uploads/default_og_image.png`;
    let shareUrl = `${hostUrl}${req.originalUrl || req.url}`;

    // Extract post ID if matching /posts/:id
    const postMatch = req.path.match(/^\/posts\/([a-zA-Z0-9_-]+)/);
    if (postMatch) {
      const postId = postMatch[1];
      let post = null;

      // Try fetching from MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const Post = require("./models/Post");
          post = await Post.findById(postId).populate("creator", "username displayName avatar hasPremium");
        } catch (dbErr) {
          console.warn("MongoDB fetch failed for OG tags, using mock fallback:", dbErr.message);
        }
      }

      // Fallback to mock posts
      if (!post && global.mockPosts) {
        post = global.mockPosts.find(p => p._id === postId || p.id === postId);
      }

      if (post) {
        title = `${post.title} by ${post.creator?.displayName || post.creator?.username || 'Creator'} | Aethra`;
        description = post.description || `Check out this amazing ${post.contentType || 'creation'} on Aethra!`;

        let contentUrl = post.content;
        if (contentUrl && (contentUrl.startsWith("http://") || contentUrl.startsWith("https://"))) {
          imageUrl = contentUrl;
        } else if (contentUrl && contentUrl.startsWith("/uploads/")) {
          imageUrl = `${hostUrl}${contentUrl}`;
        } else if (contentUrl && contentUrl.startsWith("uploads/")) {
          imageUrl = `${hostUrl}/${contentUrl}`;
        } else {
          // If emoji or custom local markup (like SVG data), use the default banner
          imageUrl = `${hostUrl}/uploads/default_og_image.png`;
        }
        shareUrl = `${hostUrl}/posts/${postId}`;
      }
    }

    // Simple escaper for HTML attributes
    const esc = (str) => {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Construct meta tags string
    const ogTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${esc(shareUrl)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(imageUrl)}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${esc(shareUrl)}">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(imageUrl)}">
    `;

    // Inject meta tags inside head block
    html = html.replace("<head>", `<head>${ogTags}`);

    // Update title tag
    html = html.replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`);

    res.send(html);
  } catch (err) {
    console.error("SPA Fallback injection error:", err);
    res.sendFile(indexPath);
  }
});

// Serve actual static files (after routing fallback so clean paths match the fallback)
app.use(express.static(path.join(__dirname, "../")));

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
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
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