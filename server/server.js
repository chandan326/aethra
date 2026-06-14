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

// ── Middleware ────────────────────────────────────────────────────────────────
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

// ── API Routes ────────────────────────────────────────────────────────────────
const postRoutes    = require("./routes/posts");
const channelRoutes = require("./routes/channels");
const chatRoutes    = require("./routes/chat");
const supportRoutes = require("./routes/support");

app.use("/api/auth",     authRoutes);
app.use("/api/posts",    postRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/chat",     chatRoutes);
app.use("/api/support",  supportRoutes);

// ── Static / Uploads ──────────────────────────────────────────────────────────
const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
const uploadDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(uploadDir));

// ── SPA Fallback with OG meta-tag injection ───────────────────────────────────
app.get(/.*/, async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.includes(".")) {
    return next();
  }

  const indexPath = path.join(__dirname, "../index.html");
  if (!fs.existsSync(indexPath)) return res.status(404).send("index.html not found");

  try {
    let html = fs.readFileSync(indexPath, "utf8");

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

// Serve static files from project root
app.use(express.static(path.join(__dirname, "../")));

// ── MongoDB: disable buffering so offline fallback triggers immediately ────────
mongoose.set("bufferCommands", false);

const port     = process.env.PORT || 5000;
const atlasUri = process.env.MONGO_URI;
const localUri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/aethra";

const dnsPromises = require("dns").promises;

async function resolveSrvToStandardUri(srvUri) {
  if (!srvUri || !srvUri.startsWith("mongodb+srv://")) return srvUri;
  
  try {
    const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]*)(?:\?(.*))?$/);
    if (!match) return srvUri;
    
    const [, username, password, srvHost, database, originalOptions] = match;
    
    // Create resolver and use public DNS servers as fallback
    const resolver = new dnsPromises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    
    console.log(`🔍 Resolving SRV records for _mongodb._tcp.${srvHost}...`);
    const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${srvHost}`);
    if (!srvRecords || !srvRecords.length) {
      throw new Error("No SRV records found");
    }
    
    const hostsList = srvRecords.map(r => `${r.name}:${r.port}`).join(",");
    
    // Resolve TXT options (like replicaSet name)
    let txtOptions = "";
    try {
      const txtRecords = await resolver.resolveTxt(srvHost);
      if (txtRecords && txtRecords.length) {
        txtOptions = txtRecords[0].join("&");
      }
    } catch (txtErr) {
      console.warn("⚠️ TXT resolution failed, continuing without TXT options:", txtErr.message);
    }
    
    // Build standard connection string
    let finalOptions = "ssl=true";
    if (txtOptions) finalOptions += `&${txtOptions}`;
    if (originalOptions) finalOptions += `&${originalOptions}`;
    
    const standardUri = `mongodb://${username}:${password}@${hostsList}/${database}?${finalOptions}`;
    console.log("✅ Successfully resolved SRV to standard connection string!");
    return standardUri;
  } catch (err) {
    console.warn("⚠️ DNS SRV resolution failed, falling back to original URI:", err.message);
    return srvUri;
  }
}

/**
 * ✅ FIXED: ONE startup connection attempt only.
 * DO NOT add per-request reconnect middleware — it causes 5s timeouts on Vercel.
 * Every route already checks mongoose.connection.readyState and falls back to mock data.
 */
async function startServer() {
  const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
  
  if (atlasUri) {
    try {
      // Use shorter timeout on Vercel to fail fast and prevent cold start timeout
      const timeout = isVercel ? 2000 : 5000;
      const resolvedUri = await resolveSrvToStandardUri(atlasUri);
      await mongoose.connect(resolvedUri, { serverSelectionTimeoutMS: timeout });
      console.log("✅ Connected to MongoDB Atlas");
      await seedDatabase();
      return;
    } catch (err) {
      console.error("❌ Atlas connection failed:", err.message);
    }
  }

  // Skip trying local MongoDB on Vercel
  if (!isVercel) {
    try {
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
      console.log("✅ Connected to local MongoDB");
      await seedDatabase();
      return;
    } catch (err) {
      console.error("❌ Local MongoDB failed:", err.message);
    }
  }

  console.log("⚠️  Offline mock-database mode — data served from JSON cache.");
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("🚨 JWT_SECRET not set in production!");
}

startServer();

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
}

module.exports = app;