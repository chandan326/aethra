const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION !== undefined;
const uploadDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
    cb(null, "qr_" + Date.now() + sanitizedExt);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only images (PNG, JPG, WEBP) are allowed for QR Code!"));
  }
});

// Secure wrapper middleware to catch Multer errors gracefully
const uploadSingleQr = (req, res, next) => {
  upload.single("qrCodeImage")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File is too large. Max size allowed is 5MB." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

const JWT_SECRET = process.env.JWT_SECRET || "aethrasecretkey_change_in_production";

// Register
router.post("/register", async (req, res) => {
  console.log("🔥 REGISTER ROUTE HIT");
  console.log("Mongo State:", mongoose.connection.readyState);

  const { username, email, password } = req.body;

  if (mongoose.connection.readyState !== 1) {
    const token = jwt.sign({ id: "mock_user_id", username }, JWT_SECRET, { expiresIn: "7d" });
    return res.status(201).json({ token, user: { id: "mock_user_id", username, email } });
  }

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) return res.status(400).json({ message: "Username or email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      username,
      email,
      password: hashedPassword,
      displayName: username,
      avatar: username.slice(0, 2).toUpperCase()
    });
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const mongoose = require("mongoose");
  const { username, password } = req.body;

  if (mongoose.connection.readyState !== 1) {
    // Let any password pass for easy offline preview testing
    const token = jwt.sign({ id: "mock_user_id", username }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: "mock_user_id", username, email: `${username}@example.com`, avatar: username.slice(0, 2).toUpperCase() } });
  }

  try {
    const user = await User.findOne({ $or: [{ email: username }, { username }] });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Current User Profile
router.get("/me", auth, async (req, res) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    return res.json({
      _id: req.user.id || "mock_user_id",
      username: req.user.username || "preview_user",
      displayName: req.user.username || "Preview User",
      avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase(),
      bio: "Offline Preview User - changes are not saved.",
      location: "India 🇮🇳",
      upiId: "preview@okaxis",
      followers: [],
      following: [],
      verified: true,
      earnings: 24000,
      hasPremium: false,
      subscriptionPlan: ""
    });
  }

  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const userObj = user.toObject();
    userObj.id = user._id;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Public User Profile by ID
router.get("/user/:id", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({
      _id: req.params.id,
      username: "creator_" + req.params.id.slice(-4),
      displayName: "Creator " + req.params.id.slice(-4),
      avatar: "CR",
      bio: "This is a preview creator profile bio.",
      location: "India 🇮🇳",
      upiId: "creator@okaxis",
      followers: [],
      following: [],
      verified: true,
      earnings: 15000,
      hasPremium: false,
      subscriptionPlan: ""
    });
  }

  try {
    const user = await User.findById(req.params.id).select("-password -email");
    if (!user) return res.status(404).json({ message: "User not found" });
    const userObj = user.toObject();
    userObj.id = user._id;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user profile
router.post("/profile", auth, uploadSingleQr, async (req, res) => {
  const mongoose = require("mongoose");
  const { displayName, bio, location, upiId, clearQrCodeImage } = req.body;
  let qrCodeImage = undefined;
  if (req.file) {
    try {
      const filePath = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = req.file.mimetype || "image/png";
      const base64Data = fileBuffer.toString("base64");
      qrCodeImage = `data:${mimeType};base64,${base64Data}`;
      
      // Delete temporary file to save space
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    } catch (err) {
      console.error("Error converting QR file to base64:", err);
      qrCodeImage = `/uploads/${req.file.filename}`;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return res.json({
      message: "Profile updated successfully (Offline Preview Mode)",
      user: {
        id: req.user.id || "mock_user_id",
        username: req.user.username || "preview_user",
        displayName: displayName || "Preview User",
        bio: bio || "Bio updated.",
        location: location || "India 🇮🇳",
        upiId: upiId || "username@upi",
        qrCodeImage: clearQrCodeImage === "true" ? "" : (qrCodeImage || ""),
        avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase(),
        verified: true,
        earnings: 24000,
        hasPremium: false,
        subscriptionPlan: ""
      }
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (upiId !== undefined) user.upiId = upiId;
    
    if (clearQrCodeImage === "true") {
      user.qrCodeImage = "";
    } else if (qrCodeImage !== undefined) {
      user.qrCodeImage = qrCodeImage;
    }

    await user.save();

    const userObj = user.toObject();
    userObj.id = user._id;
    res.json({ message: "Profile updated successfully!", user: userObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upgrade user to Premium subscription
router.post("/subscribe", auth, async (req, res) => {
  const mongoose = require("mongoose");
  const { planName, months } = req.body;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (months || 2));

  if (mongoose.connection.readyState !== 1) {
    return res.json({
      message: "Subscription activated successfully! (Offline Preview Mode)",
      user: {
        id: req.user.id || "mock_user_id",
        username: req.user.username || "preview_user",
        displayName: req.user.username || "Preview User",
        avatar: (req.user.username || "preview_user").slice(0, 2).toUpperCase(),
        bio: "Offline Preview User",
        location: "India 🇮🇳",
        upiId: "username@upi",
        verified: true,
        earnings: 24000,
        hasPremium: true,
        subscriptionPlan: planName || "2 Months Boost",
        subscriptionExpiresAt: expiresAt
      }
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.hasPremium = true;
    user.subscriptionPlan = planName || "2 Months Boost";
    user.subscriptionExpiresAt = expiresAt;
    await user.save();

    const userObj = user.toObject();
    userObj.id = user._id;
    res.json({ message: "Subscription activated successfully!", user: userObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Follow / Unfollow a creator
router.post("/follow/:id", auth, async (req, res) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    return res.json({ message: "Follow action simulated successfully (Offline Preview Mode)" });
  }

  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const creator = await User.findById(req.params.id);
    const me = await User.findById(req.user.id);

    if (!creator || !me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFollowing = me.following.includes(creator._id);

    if (isFollowing) {
      // Unfollow
      me.following = me.following.filter(id => id.toString() !== creator._id.toString());
      creator.followers = creator.followers.filter(id => id.toString() !== me._id.toString());
    } else {
      // Follow
      me.following.push(creator._id);
      creator.followers.push(me._id);
    }

    await me.save();
    await creator.save();

    res.json({ 
      message: isFollowing ? "Unfollowed successfully!" : "Followed successfully!",
      isFollowing: !isFollowing,
      followersCount: creator.followers.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
