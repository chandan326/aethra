require("dotenv").config();

const dns = require("dns");
// Fix Node.js DNS SRV resolution error (ECONNREFUSED querySrv) on Windows local network adapters
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {
  console.warn("⚠️ Could not override DNS servers:", e.message);
}
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const seedDatabase = require("./utils/seeder");
const zlib = require("zlib");

const authRoutes = require("./routes/auth");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
// GZIP Compression Middleware for faster response times
app.use((req, res, next) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (!acceptEncoding.includes("gzip")) return next();

  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      const contentType = res.getHeader("Content-Type") || "";
      if (!contentType || contentType.includes("text") || contentType.includes("json") || contentType.includes("javascript") || contentType.includes("html") || contentType.includes("css")) {
        const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
        if (buffer.length > 512) {
          zlib.gzip(buffer, (err, compressed) => {
            if (!err) {
              res.setHeader("Content-Encoding", "gzip");
              res.setHeader("Content-Length", compressed.length);
              res.end(compressed);
            } else {
              originalSend.call(this, body);
            }
          });
          return;
        }
      }
    }
    return originalSend.call(this, body);
  };
  next();
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Secure HTTP Headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Block direct access to sensitive file types
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
    file.startsWith(".git")
  ) {
    return res.status(403).json({ message: "Access forbidden" });
  }
  next();
});

// ── MongoDB Connection Manager ───────────────────────────────────────────────
const atlasUri = process.env.MONGO_URI || "mongodb+srv://chandanrai771714_db_user:Test12345@cluster0.cxkc0uv.mongodb.net/aethra?retryWrites=true&w=majority";
const localUri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/aethra";

let dbConnectPromise = null;

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return true;
  if (dbConnectPromise) return dbConnectPromise;

  dbConnectPromise = (async () => {
    try {
      if (atlasUri) {
        await mongoose.connect(atlasUri, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ Connected to MongoDB Atlas");
        await seedDatabase();
        return true;
      }
    } catch (err) {
      console.error("❌ Atlas connection failed:", err.message);
      global.mongoConnectionError = err.message;
      const isVercelEnv = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
      if (!isVercelEnv) {
        try {
          await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
          console.log("✅ Connected to local MongoDB");
          await seedDatabase();
          return true;
        } catch (e) {
          console.error("❌ Local Mongo failed:", e.message);
        }
      }
    } finally {
      dbConnectPromise = null;
    }
    return false;
  })();

  return dbConnectPromise;
}

// Immediately trigger DB connection on load
ensureDbConnected();

// Ensure DB connection is established before serving any API route
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    await ensureDbConnected();
  }
  next();
});

// ── API Routes ────────────────────────────────────────────────────────────────
const postRoutes    = require("./routes/posts");
const channelRoutes = require("./routes/channels");
const chatRoutes    = require("./routes/chat");
const supportRoutes = require("./routes/support");
const paymentRoutes = require("./routes/payment");

app.use("/api/auth",     authRoutes);
app.use("/api/posts",    postRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/chat",     chatRoutes);
app.use("/api/support",  supportRoutes);
app.use("/api/payment",  paymentRoutes);

app.get("/api/db-status", (req, res) => {
  const state = mongoose.connection.readyState;
  res.json({
    connected: state === 1,
    readyState: state,
    error: global.mongoConnectionError || null,
    envMongoUriSet: !!process.env.MONGO_URI,
    isVercel: process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined
  });
});

// ── Static / Uploads ──────────────────────────────────────────────────────────
const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
const uploadDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const staticOptions = { maxAge: '1d', etag: true };
app.use("/uploads", express.static(path.join(__dirname, "uploads"), staticOptions));
app.use("/uploads", express.static(uploadDir, staticOptions));

// In-Memory index.html cache helper to eliminate disk read latency on SPA navigation
let cachedIndexContent = null;
let cachedIndexMtime = 0;
function getCachedIndexHtml(indexPath) {
  try {
    const stat = fs.statSync(indexPath);
    if (!cachedIndexContent || stat.mtimeMs > cachedIndexMtime) {
      cachedIndexContent = fs.readFileSync(indexPath, "utf8");
      cachedIndexMtime = stat.mtimeMs;
    }
    return cachedIndexContent;
  } catch (e) {
    return fs.readFileSync(indexPath, "utf8");
  }
}

// ── SPA Fallback with OG meta-tag injection ───────────────────────────────────
app.get(/.*/, async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.includes(".")) {
    return next();
  }

  const indexPath = path.join(__dirname, "../index.html");
  if (!fs.existsSync(indexPath)) return res.status(404).send("index.html not found");

  try {
    let html = getCachedIndexHtml(indexPath);

    let title       = "Aethra — Create. Inspire. Belong.";
    let description = "Discover and share premium digital art, GIFs, and stickers on Aethra.";
    const hostUrl   = `${req.protocol}://${req.get("host")}`;
    let imageUrl    = `${hostUrl}/uploads/default_og_image.png`;
    let shareUrl    = `${hostUrl}${req.originalUrl || req.url}`;

    const postMatch = req.path.match(/^\/posts\/([a-zA-Z0-9_-]+)/);
    if (postMatch) {
      const postId = postMatch[1];
      let post = null;

      if (mongoose.connection.readyState === 1) {
        try {
          const Post = require("./models/Post");
          post = await Post.findById(postId).populate("creator", "username displayName avatar hasPremium");
        } catch (dbErr) {
          console.warn("OG fetch failed, using mock:", dbErr.message);
        }
      }
      if (!post && global.mockPosts) {
        post = global.mockPosts.find(p => p._id === postId || p.id === postId);
      }
      if (post) {
        title       = `${post.title} by ${post.creator?.displayName || post.creator?.username || "Creator"} | Aethra`;
        description = post.description || `Check out this ${post.contentType || "creation"} on Aethra!`;
        const cu    = post.content;
        if (cu && (cu.startsWith("http://") || cu.startsWith("https://"))) imageUrl = cu;
        else if (cu && cu.startsWith("/uploads/")) imageUrl = `${hostUrl}${cu}`;
        shareUrl = `${hostUrl}/posts/${postId}`;
      }
    }

    const esc = s => (!s ? "" : s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"));
    const ogTags = `
    <meta property="og:type" content="website">
    <meta property="og:url" content="${esc(shareUrl)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(imageUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(imageUrl)}">`;

    html = html.replace("<head>", `<head>${ogTags}`);
    html = html.replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`);
    res.send(html);
  } catch (err) {
    console.error("SPA fallback error:", err);
    res.sendFile(indexPath);
  }
});

// Serve static files from project root with caching
app.use(express.static(path.join(__dirname, "../"), staticOptions));

const port = process.env.PORT || 5000;

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("🚨 JWT_SECRET not set in production!");
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
}

module.exports = app;