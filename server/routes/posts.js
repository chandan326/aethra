const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");

const lockPaidSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230b0f19"/><g transform="translate(30,25)" stroke="%23ef4444" stroke-width="6" fill="none"><rect x="0" y="20" width="40" height="30" rx="5" fill="%231e1e2d"/><path d="M10,20 V10 A10,10 0 0,1 30,10 V20"/></g><text x="50" y="80" fill="%23ef4444" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">PAID ART</text></svg>';
const lockFollowersSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230b0f19"/><g transform="translate(30,25)" stroke="%2306b6d4" stroke-width="6" fill="none"><rect x="0" y="20" width="40" height="30" rx="5" fill="%2313252f"/><path d="M10,20 V10 A10,10 0 0,1 30,10 V20"/></g><text x="50" y="80" fill="%2306b6d4" font-family="sans-serif" font-size="8" font-weight="bold" text-anchor="middle">FOLLOWERS ONLY</text></svg>';
const lockPrivateSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230b0f19"/><g transform="translate(30,25)" stroke="%236b7280" stroke-width="6" fill="none"><rect x="0" y="20" width="40" height="30" rx="5" fill="%231f2937"/><path d="M10,20 V10 A10,10 0 0,1 30,10 V20"/></g><text x="50" y="80" fill="%239ca3af" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">PRIVATE</text></svg>';

if (!global.mockPosts) {
  global.mockPosts = [
    { _id: "p1", title: "Cosmic Dreamscape", content: lockPaidSvg, securedContent: "🌌", contentType: "AI", pricing: "paid", price: 99, creator: { _id: "u1", id: "u1", username: "artby_meera", displayName: "Meera Art", avatar: "🎨", verified: true, hasPremium: true }, likes: ["u1"], commentsCount: 89 },
    { _id: "p2", title: "Neon Dragon", content: "🐉", securedContent: "🐉", contentType: "AI", pricing: "free", creator: { _id: "u2", id: "u2", username: "vfx_ravi", displayName: "VFX Ravi", avatar: "🔮", verified: false }, likes: [], commentsCount: 67 },
    { _id: "p3", title: "Sakura Rain", content: "🌸", securedContent: "🌸", contentType: "AI", pricing: "free", creator: { _id: "u3", id: "u3", username: "pixel_priya", displayName: "Pixel Priya", avatar: "🌸", verified: true }, likes: [], commentsCount: 124 },
    { _id: "p4", title: "Cyber Samurai", content: lockPaidSvg, securedContent: "🤖", contentType: "AI", pricing: "paid", price: 149, creator: { _id: "u4", id: "u4", username: "cyberpunk_dev", displayName: "Neon Dev", avatar: "⚡", verified: true }, likes: [], commentsCount: 203 },
    { _id: "p5", title: "Galaxy Spin", content: "💫", securedContent: "💫", contentType: "GIF", pricing: "free", creator: { _id: "u5", id: "u5", username: "space_gifs", displayName: "Space Gifs", avatar: "💫", verified: false }, likes: [], commentsCount: 234 },
    { _id: "p6", title: "Fire Dance", content: "🔥", securedContent: "🔥", contentType: "GIF", pricing: "free", creator: { _id: "u6", id: "u6", username: "pyro_art", displayName: "Pyro Art", avatar: "🔥", verified: false }, likes: [], commentsCount: 98 },
    { _id: "p7", title: "Cool Cat Pack", content: "😎", securedContent: "😎", contentType: "STICKER", pricing: "free", creator: { _id: "u7", id: "u7", username: "catlife", displayName: "Cat Life", avatar: "😺", verified: true }, likes: [], commentsCount: 567 },
    { _id: "p8", title: "Love Hearts", content: "🥰", securedContent: "🥰", contentType: "STICKER", pricing: "free", creator: { _id: "u8", id: "u8", username: "lovedesign", displayName: "Love Design", avatar: "🥰", verified: false }, likes: [], commentsCount: 423 },
    { _id: "p9", title: "Midnight Vibes", content: lockPaidSvg, securedContent: "🌙", contentType: "STICKER", pricing: "paid", price: 29, creator: { _id: "u1", id: "u1", username: "artby_meera", displayName: "Meera Art", avatar: "🎨", verified: true, hasPremium: true }, likes: [], commentsCount: 298 }
  ];
}
const mockPosts = global.mockPosts;

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

  const isPaid = pricing === "paid";
  const isFollowersOnly = visibility === "followers";
  const isPrivate = visibility === "private";

  const displayContent = isPaid ? lockPaidSvg : 
                         isFollowersOnly ? lockFollowersSvg : 
                         isPrivate ? lockPrivateSvg : 
                         contentValue;

  if (mongoose.connection.readyState !== 1) {
    const newMock = {
      _id: "mock_post_" + Date.now(),
      title,
      description,
      content: displayContent,
      securedContent: contentValue,
      contentType: contentType || "AI",
      visibility: visibility || "public",
      pricing: pricing || "free",
      price: pricing === "paid" ? Number(price) : 0,
      creator: { 
        _id: req.user.id || "mock_user_id",
        id: req.user.id || "mock_user_id",
        username: req.user.username || "preview_user", 
        displayName: req.user.username || "Preview User", 
        avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase() 
      },
      likes: [],
      commentsCount: 0,
      createdAt: new Date()
    };
    mockPosts.unshift(newMock);
    return res.status(201).json(newMock);
  }

  try {
    const post = new Post({
      title,
      description,
      content: displayContent,
      securedContent: contentValue,
      contentType: contentType || "AI",
      visibility: visibility || "public",
      pricing: pricing || "free",
      price: pricing === "paid" ? Number(price) : 0,
      creator: req.user.id
    });
    
    await post.save();
    
    const populatedPost = await Post.findById(post._id).populate("creator", "username displayName avatar verified hasPremium qrCodeImage");
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Posts (with filters)
router.get("/", async (req, res) => {
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("JWT_SECRET environment variable is required in production!"); })() : "aethrasecretkey_change_in_production");
  
  // Optional Authentication to get current user ID
  let userId = null;
  const authHeader = req.header("Authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // Ignore invalid token
    }
  }

  // Instantly return mock data if MongoDB is offline
  if (mongoose.connection.readyState !== 1) {
    const { type, pricing, creator } = req.query;
    let filtered = [...mockPosts];
    
    const me = userId ? (global.mockUsersDb ? global.mockUsersDb[userId] : null) : null;
    const followingList = me ? (me.following || []) : [];
    const purchasedSet = new Set(me ? (me.purchasedPosts || []) : []);
    
    if (creator) {
      if (userId && userId.toString() === creator.toString()) {
        filtered = filtered.filter(p => {
          const cId = p.creator?._id || p.creator?.id || p.creator;
          return cId && cId.toString() === creator.toString();
        });
      } else {
        filtered = filtered.filter(p => {
          const cId = p.creator?._id || p.creator?.id || p.creator;
          return cId && cId.toString() === creator.toString() && p.visibility !== "private";
        });
      }
    } else {
      filtered = filtered.filter(p => {
        if (p.visibility === "public") return true;
        if (p.visibility === "followers") {
          const cId = p.creator?._id || p.creator?.id || p.creator;
          return cId && (cId.toString() === userId?.toString() || followingList.includes(cId.toString()));
        }
        return false;
      });
    }

    if (type && type !== "all") {
      filtered = filtered.filter(p => p.contentType.toUpperCase() === type.toUpperCase());
    }
    if (pricing && pricing !== "all") {
      filtered = filtered.filter(p => p.pricing === pricing);
    }
    
    const mapped = filtered.map(p => {
      const postObj = { ...p };
      const cId = p.creator?._id || p.creator?.id || p.creator;
      const isCreator = userId && cId && cId.toString() === userId.toString();
      
      const creatorUser = (cId && global.mockUsersDb) ? global.mockUsersDb[cId.toString()] : null;
      const isFollower = userId && creatorUser && creatorUser.followers && creatorUser.followers.includes(userId);
      const isPurchased = userId && purchasedSet.has(p._id.toString());
      
      if (isCreator) {
        postObj.content = p.securedContent || p.content;
      } else {
        if (p.visibility === "private") {
          postObj.content = lockPrivateSvg;
        } else if (p.visibility === "followers") {
          if (isFollower) {
            postObj.content = p.securedContent || p.content;
          } else {
            postObj.content = lockFollowersSvg;
          }
        } else if (p.pricing === "paid") {
          if (isPurchased) {
            postObj.content = p.securedContent || p.content;
            postObj.isPurchased = true;
          } else {
            postObj.content = lockPaidSvg;
            postObj.isPurchased = false;
          }
        } else {
          postObj.content = p.securedContent || p.content;
        }
      }
      return postObj;
    });

    return res.json(mapped);
  }

  try {
    const { type, pricing, creator } = req.query;

    let me = userId ? await User.findById(userId) : null;
    const followingList = me ? (me.following || []) : [];
    const purchasedSet = new Set(me ? (me.purchasedPosts || []).map(id => id.toString()) : []);

    let filter = {};
    if (creator) {
      if (userId && userId.toString() === creator.toString()) {
        filter = { creator };
      } else {
        filter = { creator, visibility: { $ne: "private" } };
      }
    } else {
      if (userId) {
        filter = {
          $or: [
            { visibility: "public" },
            { visibility: "followers", creator: { $in: followingList } }
          ]
        };
      } else {
        filter = { visibility: "public" };
      }
    }

    if (type && type !== "all") {
      filter.contentType = type.toUpperCase();
    }
    if (pricing && pricing !== "all") {
      filter.pricing = pricing;
    }

    const posts = await Post.find(filter)
      .populate("creator", "username displayName avatar verified hasPremium qrCodeImage followers")
      .sort({ createdAt: -1 });

    const mapped = posts.map(p => {
      const postObj = p.toObject();
      const cId = p.creator?._id || p.creator?.id || p.creator;
      const isCreator = userId && cId && cId.toString() === userId.toString();
      
      const isFollower = userId && p.creator && p.creator.followers && p.creator.followers.some(f => f.toString() === userId.toString());
      const isPurchased = userId && purchasedSet.has(p._id.toString());
      
      if (isCreator) {
        postObj.content = p.securedContent || p.content;
      } else {
        if (p.visibility === "private") {
          postObj.content = lockPrivateSvg;
        } else if (p.visibility === "followers") {
          if (isFollower) {
            postObj.content = p.securedContent || p.content;
          } else {
            postObj.content = lockFollowersSvg;
          }
        } else if (p.pricing === "paid") {
          if (isPurchased) {
            postObj.content = p.securedContent || p.content;
            postObj.isPurchased = true;
          } else {
            postObj.content = lockPaidSvg;
            postObj.isPurchased = false;
          }
        } else {
          postObj.content = p.securedContent || p.content;
        }
      }
      return postObj;
    });
      
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Purchase Premium Post
router.post("/:id/purchase", auth, async (req, res) => {
  const mongoose = require("mongoose");
  const postId = req.params.id;
  const myId = req.user.id || "mock_user_id";

  if (mongoose.connection.readyState !== 1) {
    const post = global.mockPosts.find(p => p._id === postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!global.mockUsersDb) global.mockUsersDb = {};
    let me = global.mockUsersDb[myId];
    if (!me) {
      global.mockUsersDb[myId] = {
        _id: myId,
        id: myId,
        username: req.user.username || "preview_user",
        displayName: req.user.username || "Preview User",
        avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase(),
        bio: "Offline Preview User",
        location: "India 🇮🇳",
        upiId: "preview@okaxis",
        followers: [],
        following: [],
        purchasedPosts: [],
        verified: true,
        earnings: 24000,
        hasPremium: false
      };
      me = global.mockUsersDb[myId];
    }

    if (!me.purchasedPosts) me.purchasedPosts = [];
    if (!me.purchasedPosts.includes(postId)) {
      me.purchasedPosts.push(postId);
      
      const cId = post.creator?._id || post.creator?.id || post.creator;
      const creator = global.mockUsersDb[cId];
      if (creator) {
        creator.earnings = (creator.earnings || 0) + (post.price || 0);
      }
    }

    return res.json({ message: "Post purchased successfully! (Offline Preview Mode)" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const me = await User.findById(myId);
    if (!me) return res.status(404).json({ message: "User not found" });

    if (!me.purchasedPosts.includes(postId)) {
      me.purchasedPosts.push(postId);
      await me.save();

      const creator = await User.findById(post.creator);
      if (creator) {
        creator.earnings = (creator.earnings || 0) + (post.price || 0);
        await creator.save();
      }
    }

    res.json({ message: "Post purchased successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Unlocked Content
router.get("/:id/unlocked", auth, async (req, res) => {
  const mongoose = require("mongoose");
  const postId = req.params.id;
  const myId = req.user.id || "mock_user_id";

  if (mongoose.connection.readyState !== 1) {
    const post = global.mockPosts.find(p => p._id === postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const cId = post.creator?._id || post.creator?.id || post.creator;
    const isCreator = cId && cId.toString() === myId.toString();

    const me = global.mockUsersDb ? global.mockUsersDb[myId] : null;
    const isPurchased = me && me.purchasedPosts && me.purchasedPosts.includes(postId);

    const creatorUser = (cId && global.mockUsersDb) ? global.mockUsersDb[cId.toString()] : null;
    const isFollower = creatorUser && creatorUser.followers && creatorUser.followers.includes(myId);

    const isFree = post.pricing === "free";
    const isFollowersOnly = post.visibility === "followers";

    const hasAccess = isCreator || isPurchased || isFree || (isFollowersOnly && isFollower);

    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to download this post." });
    }

    return res.json({ securedContent: post.securedContent || post.content });
  }

  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const cId = post.creator?._id || post.creator?.id || post.creator;
    const isCreator = cId && cId.toString() === myId.toString();

    const me = await User.findById(myId);
    const isPurchased = me && me.purchasedPosts && me.purchasedPosts.includes(postId);

    const isFollower = post.creator && post.creator.followers && post.creator.followers.some(f => f.toString() === myId.toString());

    const isFree = post.pricing === "free";
    const isFollowersOnly = post.visibility === "followers";

    const hasAccess = isCreator || isPurchased || isFree || (isFollowersOnly && isFollower);

    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to download this post." });
    }

    res.json({ securedContent: post.securedContent || post.content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle Like
router.post("/:id/like", auth, async (req, res) => {
  const mongoose = require("mongoose");
  
  if (mongoose.connection.readyState !== 1) {
    const postId = req.params.id;
    const myId = req.user.id || "mock_user_id";
    
    const post = mockPosts.find(p => p._id === postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    
    if (!post.likes) post.likes = [];
    const index = post.likes.indexOf(myId);
    if (index === -1) {
      post.likes.push(myId);
    } else {
      post.likes.splice(index, 1);
    }
    
    return res.json({ likesCount: post.likes.length, isLiked: post.likes.includes(myId) });
  }

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
