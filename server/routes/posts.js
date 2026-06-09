const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");

// Ensure upload directory exists
const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
const uploadDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
    cb(null, "post_" + Date.now() + sanitizedExt);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only images (PNG, JPG, WEBP) and GIFs are allowed for posts!"));
  }
});

const uploadSinglePostMedia = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File is too large. Max size allowed is 50MB." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Create Post
router.post("/", auth, uploadSinglePostMedia, async (req, res) => {
  const mongoose = require("mongoose");
  const { title, description, contentType, visibility, pricing, price, content } = req.body;
  
  // Type validation to prevent type-injection and object payload bypasses
  if (typeof title !== "string" || 
      (description && typeof description !== "string") || 
      (contentType && typeof contentType !== "string") || 
      (visibility && typeof visibility !== "string") || 
      (pricing && typeof pricing !== "string") || 
      (content && typeof content !== "string")) {
    return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
  }
  
  // Determine content URL/path or emoji
  let contentValue = content || "🎨";
  if (req.file) {
    try {
      const filePath = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = req.file.mimetype || "image/png";
      const base64Data = fileBuffer.toString("base64");
      contentValue = `data:${mimeType};base64,${base64Data}`;
      
      // Delete temporary file to save space
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    } catch (err) {
      console.error("Error converting file to base64:", err);
      contentValue = `/uploads/${req.file.filename}`;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(201).json({
      _id: "mock_post_" + Date.now(),
      title,
      description,
      content: contentValue,
      contentType: contentType || "AI",
      visibility: visibility || "public",
      pricing: pricing || "free",
      price: pricing === "paid" ? Number(price) : 0,
      creator: { username: req.user.username || "preview_user", displayName: req.user.username || "Preview User", avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase() },
      likes: [],
      commentsCount: 0,
      createdAt: new Date()
    });
  }

  try {
    const post = new Post({
      title,
      description,
      content: contentValue,
      contentType: contentType || "AI",
      visibility: visibility || "public",
      pricing: pricing || "free",
      price: pricing === "paid" ? Number(price) : 0,
      creator: req.user.id
    });
    
    await post.save();
    
    // Increment creator posts count (if we track it, or just return the saved post populated)
    const populatedPost = await Post.findById(post._id).populate("creator", "username displayName avatar verified hasPremium qrCodeImage");
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const mockPosts = [
  { _id: "p1", title: "Cosmic Dreamscape", content: "🌌", contentType: "AI", pricing: "paid", price: 99, creator: { username: "artby_meera", displayName: "Meera Art", avatar: "🎨", verified: true, hasPremium: true }, likes: ["u1"], commentsCount: 89 },
  { _id: "p2", title: "Neon Dragon", content: "🐉", contentType: "AI", pricing: "free", creator: { username: "vfx_ravi", displayName: "VFX Ravi", avatar: "🔮", verified: false }, likes: [], commentsCount: 67 },
  { _id: "p3", title: "Sakura Rain", content: "🌸", contentType: "AI", pricing: "free", creator: { username: "pixel_priya", displayName: "Pixel Priya", avatar: "🌸", verified: true }, likes: [], commentsCount: 124 },
  { _id: "p4", title: "Cyber Samurai", content: "🤖", contentType: "AI", pricing: "paid", price: 149, creator: { username: "ai_arjun", displayName: "AI Arjun", avatar: "⚡", verified: true }, likes: [], commentsCount: 203 },
  { _id: "p5", title: "Galaxy Spin", content: "💫", contentType: "GIF", pricing: "free", creator: { username: "space_gifs", displayName: "Space Gifs", avatar: "💫", verified: false }, likes: [], commentsCount: 234 },
  { _id: "p6", title: "Fire Dance", content: "🔥", contentType: "GIF", pricing: "free", creator: { username: "pyro_art", displayName: "Pyro Art", avatar: "🔥", verified: false }, likes: [], commentsCount: 98 },
  { _id: "p7", title: "Cool Cat Pack", content: "😎", contentType: "STICKER", pricing: "free", creator: { username: "catlife", displayName: "Cat Life", avatar: "😺", verified: true }, likes: [], commentsCount: 567 },
  { _id: "p8", title: "Love Hearts", content: "🥰", contentType: "STICKER", pricing: "free", creator: { username: "lovedesign", displayName: "Love Design", avatar: "🥰", verified: false }, likes: [], commentsCount: 423 },
  { _id: "p9", title: "Midnight Vibes", content: "🌙", contentType: "STICKER", pricing: "paid", price: 29, creator: { username: "nocturnal", displayName: "Nocturnal", avatar: "🌙", verified: false }, likes: [], commentsCount: 298 }
];

// Get Posts (with filters)
router.get("/", async (req, res) => {
  const mongoose = require("mongoose");
  
  // Instantly return mock data if MongoDB is offline
  if (mongoose.connection.readyState !== 1) {
    const { type, pricing } = req.query;
    let filtered = [...mockPosts];
    if (type && type !== "all") {
      filtered = filtered.filter(p => p.contentType.toUpperCase() === type.toUpperCase());
    }
    if (pricing && pricing !== "all") {
      filtered = filtered.filter(p => p.pricing === pricing);
    }
    return res.json(filtered);
  }

  try {
    const { type, pricing, creator } = req.query;
    const filter = { visibility: "public" }; // By default only show public posts

    if (type && type !== "all") {
      filter.contentType = type.toUpperCase();
    }
    if (pricing && pricing !== "all") {
      filter.pricing = pricing;
    }
    if (creator) {
      filter.creator = creator;
    }

    const posts = await Post.find(filter)
      .populate("creator", "username displayName avatar verified hasPremium qrCodeImage")
      .sort({ createdAt: -1 });
      
    res.json(posts);
  } catch (err) {
    res.json(mockPosts);
  }
});

// Toggle Like
router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.id || req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const index = post.likes.indexOf(req.user.id);
    if (index === -1) {
      post.likes.push(req.user.id);
    } else {
      post.likes.splice(index, 1);
    }

    await post.save();
    res.json({ likesCount: post.likes.length, isLiked: post.likes.includes(req.user.id) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
