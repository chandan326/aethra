const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { uploadToCloudinary } = require("../utils/cloudinary");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sendVerificationEmail } = require("../utils/email");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const mockUsersDbPath = path.join(__dirname, "../mockUsersDb.json");

function saveMockUsers() {
  try {
    fs.writeFileSync(mockUsersDbPath, JSON.stringify(global.mockUsersDb, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save mockUsersDb to cache:", err);
  }
}

global.saveMockUsers = saveMockUsers;

let mockUsersDb = {};
if (fs.existsSync(mockUsersDbPath)) {
  try {
    mockUsersDb = JSON.parse(fs.readFileSync(mockUsersDbPath, "utf8"));
  } catch (err) {
    console.error("Failed to load mockUsersDb from cache:", err);
  }
}

if (Object.keys(mockUsersDb).length === 0) {
  mockUsersDb = {
    "mock_user_id": {
      _id: "mock_user_id",
      id: "mock_user_id",
      username: "preview_user",
      displayName: "Preview User",
      avatar: "PR",
      bio: "Offline Preview User - changes are not saved.",
      location: "India 🇮🇳",
      upiId: "preview@okaxis",
      followers: [],
      following: ["u1"],
      verified: true,
      earnings: 24000,
      hasPremium: false,
      subscriptionPlan: ""
    },
    "u1": { id: "u1", _id: "u1", username: "artby_meera", displayName: "Meera Art", avatar: "🎨", bio: "AI Artist & designer.", location: "India 🇮🇳", verified: true, upiId: "meera@okaxis", hasPremium: true, followers: ["mock_user_id"], following: [] },
    "u2": { id: "u2", _id: "u2", username: "vfx_ravi", displayName: "VFX Ravi", avatar: "🔮", bio: "GIF Creator & animator.", location: "India 🇮🇳", verified: false, upiId: "ravi@okaxis", followers: [], following: [] },
    "u3": { id: "u3", _id: "u3", username: "pixel_priya", displayName: "Pixel Priya", avatar: "🌸", bio: "Kawaii Creator.", location: "India 🇮🇳", verified: true, upiId: "priya@okaxis", followers: [], following: [] },
    "u4": { id: "u4", _id: "u4", username: "cyberpunk_dev", displayName: "Neon Dev", avatar: "⚡", bio: "Cyberpunk artist.", location: "India 🇮🇳", verified: true, upiId: "cyberpunk@okaxis", followers: [], following: [] },
    "u5": { id: "u5", _id: "u5", username: "space_gifs", displayName: "Space Gifs", avatar: "💫", bio: "Astronomy visuals.", location: "India 🇮🇳", verified: false, upiId: "space@okaxis", followers: [], following: [] },
    "u6": { id: "u6", _id: "u6", username: "pyro_art", displayName: "Pyro Art", avatar: "🔥", bio: "Vibrant fire graphics.", location: "India 🇮🇳", verified: false, upiId: "pyro@okaxis", followers: [], following: [] },
    "u7": { id: "u7", _id: "u7", username: "catlife", displayName: "Cat Life", avatar: "😺", bio: "Sticker Designer.", location: "India 🇮🇳", verified: true, upiId: "catlife@okaxis", followers: [], following: [] },
    "u8": { id: "u8", _id: "u8", username: "lovedesign", displayName: "Love Design", avatar: "🥰", bio: "Heart stickers & custom work.", location: "India 🇮🇳", verified: false, upiId: "love@okaxis", followers: [], following: [] },
    "u9": { id: "u9", _id: "u9", username: "space_vfx", displayName: "SpaceVFX", avatar: "🌌", bio: "GIF Creator & animator.", location: "India 🇮🇳", verified: true, upiId: "space@okaxis", hasPremium: true, followers: [], following: [] },
    "u10": { id: "u10", _id: "u10", username: "mythcraft_rohit", displayName: "MythCraft", avatar: "🐉", bio: "Fantasy Art.", location: "India 🇮🇳", verified: true, upiId: "rohit@okaxis", followers: [], following: [] },
    "u11": { id: "u11", _id: "u11", username: "cyberpunk_dev", displayName: "Neon Dev", avatar: "⚡", bio: "Cyberpunk art.", location: "India 🇮🇳", verified: true, upiId: "neon@okaxis", followers: [], following: [] },
    "u12": { id: "u12", _id: "u12", username: "lens_lens", displayName: "Lens & Shutter", avatar: "📸", bio: "Landscape & street photography.", location: "India 🇮🇳", verified: true, upiId: "lens@okaxis", followers: [], following: [] },
    "u13": { id: "u13", _id: "u13", username: "synth_3d", displayName: "AI Avanti", avatar: "🤖", bio: "Illustrator and 3D visual artist.", location: "India 🇮🇳", verified: true, upiId: "avanti@okaxis", hasPremium: true, followers: [], following: [] }
  };
  try {
    fs.writeFileSync(mockUsersDbPath, JSON.stringify(mockUsersDb, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to initialize mockUsersDb cache:", err);
  }
}

global.mockUsersDb = mockUsersDb;
for (const userId in mockUsersDb) {
  if (!mockUsersDb[userId].purchasedPosts) {
    mockUsersDb[userId].purchasedPosts = [];
  }
}

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

  // Input Validation (Prevent NoSQL Injection & Bad Types)
  if (typeof username !== "string" || typeof password !== "string" || (email && typeof email !== "string")) {
    return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
  }

  if (mongoose.connection.readyState !== 1) {
    const newId = "mock_user_" + Date.now();
    mockUsersDb[newId] = {
      _id: newId,
      id: newId,
      username: username,
      displayName: username,
      avatar: username.slice(0, 2).toUpperCase(),
      bio: "Offline Preview User - changes are not saved.",
      location: "India 🇮🇳",
      upiId: "preview@okaxis",
      followers: [],
      following: [],
      purchasedPosts: [],
      verified: false,
      earnings: 0,
      hasPremium: false,
      subscriptionPlan: "",
      isEmailVerified: true
    };
    const token = jwt.sign({ id: newId, username }, JWT_SECRET, { expiresIn: "7d" });
    saveMockUsers();
    return res.status(201).json({ token, user: mockUsersDb[newId] });
  }

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) return res.status(400).json({ message: "Username or email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user = new User({
      username,
      email,
      password: hashedPassword,
      displayName: username,
      avatar: username.slice(0, 2).toUpperCase(),
      isEmailVerified: false,
      emailVerificationOtp: otp,
      emailVerificationOtpExpires: otpExpires
    });
    await user.save();

    // Send verification email
    await sendVerificationEmail(email, otp);

    const responsePayload = {
      message: "Verification code sent to your Gmail. Please verify to complete signup.",
      verificationRequired: true,
      email
    };

    // If SMTP is not set, expose OTP in development for testing convenience
    if (!process.env.SMTP_USER) {
      responsePayload.debugOtp = otp;
    }

    res.status(201).json(responsePayload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const mongoose = require("mongoose");
  const { username, password } = req.body;

  // Input Validation (Prevent NoSQL Injection & Bad Types)
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
  }

  if (mongoose.connection.readyState !== 1) {
    // Check if the user already exists in mockUsersDb
    let foundUser = Object.values(mockUsersDb).find(u => u.username === username);
    if (!foundUser) {
      const newId = "mock_user_" + Date.now();
      mockUsersDb[newId] = {
        _id: newId,
        id: newId,
        username: username,
        displayName: username,
        avatar: username.slice(0, 2).toUpperCase(),
        bio: "Offline Preview User - changes are not saved.",
        location: "India 🇮🇳",
        upiId: "preview@okaxis",
        followers: [],
        following: [],
        purchasedPosts: [],
        verified: false,
        earnings: 0,
        hasPremium: false,
        subscriptionPlan: "",
        isEmailVerified: true
      };
      foundUser = mockUsersDb[newId];
      saveMockUsers();
    }
    const token = jwt.sign({ id: foundUser.id, username: foundUser.username }, JWT_SECRET, { expiresIn: "7d" });
    saveMockUsers();
    return res.json({ token, user: foundUser });
  }

  try {
    const user = await User.findOne({ $or: [{ email: username }, { username }] });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check email verification status
    if (!user.isEmailVerified) {
      const otp = generateOtp();
      user.emailVerificationOtp = otp;
      user.emailVerificationOtpExpires = Date.now() + 10 * 60 * 1000;
      await user.save();

      await sendVerificationEmail(user.email, otp);

      const responsePayload = {
        message: "Please verify your email address to log in. Verification code sent.",
        verificationRequired: true,
        email: user.email
      };

      if (!process.env.SMTP_USER) {
        responsePayload.debugOtp = otp;
      }

      return res.status(403).json(responsePayload);
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toObject();
    delete userObj.password;
    userObj.id = user._id;
    res.json({ token, user: userObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.json({ token: "mock-token", user: { username: "preview_user", isEmailVerified: true } });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    if (user.emailVerificationOtp !== otp || Date.now() > user.emailVerificationOtpExpires) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.isEmailVerified = true;
    user.emailVerificationOtp = "";
    user.emailVerificationOtpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toObject();
    delete userObj.password;
    userObj.id = user._id;

    res.json({ token, user: userObj, message: "Email verified successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.json({ message: "OTP resent successfully (Mock mode)" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const otp = generateOtp();
    user.emailVerificationOtp = otp;
    user.emailVerificationOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, otp);

    const responsePayload = { message: "Verification code resent successfully." };
    if (!process.env.SMTP_USER) {
      responsePayload.debugOtp = otp;
    }
    res.json(responsePayload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Google Client ID
router.get("/google-client-id", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

// Google Authentication
router.post("/google", async (req, res) => {
  const { token: idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: "Google ID token is required" });
  }

  try {
    // Verify with Google tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!verifyRes.ok) {
      const errorText = await verifyRes.text();
      console.error("Google verify token response failed:", errorText);
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const payload = await verifyRes.json();
    const email = payload.email;
    if (!email) {
      return res.status(400).json({ message: "Google token did not provide an email" });
    }

    if (mongoose.connection.readyState !== 1) {
      // Mock Mode fallback
      const newId = "mock_google_user_" + Date.now();
      const mockUser = {
        _id: newId,
        id: newId,
        username: email.split("@")[0],
        displayName: payload.name || email.split("@")[0],
        avatar: payload.picture || "👤",
        bio: "Offline Google User - changes are not saved.",
        location: "India 🇮🇳",
        verified: true,
        isEmailVerified: true,
        isGoogleUser: true
      };
      mockUsersDb[newId] = mockUser;
      const jwtToken = jwt.sign({ id: newId, username: mockUser.username }, JWT_SECRET, { expiresIn: "7d" });
      saveMockUsers();
      return res.json({ token: jwtToken, user: mockUser });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      // Create a new user since it is a new Google signup
      const username = email.split("@")[0] + "_" + Math.floor(1000 + Math.random() * 9000);
      const randomPassword = await bcrypt.hash(Math.random().toString(36).substring(2, 15), 10);
      user = new User({
        username,
        email,
        password: randomPassword,
        displayName: payload.name || username,
        avatar: payload.picture || "👤",
        isEmailVerified: true,
        isGoogleUser: true
      });
      await user.save();
    } else {
      // Existing user - link Google if not already linked and verify email
      let updated = false;
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        updated = true;
      }
      if (!user.isGoogleUser) {
        user.isGoogleUser = true;
        updated = true;
      }
      if (payload.picture && (!user.avatar || user.avatar === "👤" || user.avatar.length <= 2)) {
        user.avatar = payload.picture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    const jwtToken = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toObject();
    delete userObj.password;
    userObj.id = user._id;

    res.json({ token: jwtToken, user: userObj, message: "Google Sign-In successful!" });
  } catch (err) {
    console.error("Google authentication error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// Get Current User Profile
router.get("/me", auth, async (req, res) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    const userId = req.user.id || "mock_user_id";
    let u = mockUsersDb[userId];
    if (!u) {
      mockUsersDb[userId] = {
        _id: userId,
        id: userId,
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
      };
      u = mockUsersDb[userId];
      saveMockUsers();
    }
    return res.json(u);
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
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    const creatorId = req.params.id;
    let found = mockUsersDb[creatorId];
    if (!found) {
      mockUsersDb[creatorId] = {
        _id: creatorId,
        id: creatorId,
        username: "creator_" + creatorId.slice(-4),
        displayName: "Creator " + creatorId.slice(-4),
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
      };
      found = mockUsersDb[creatorId];
    }
    return res.json(found);
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
      // Try Cloudinary upload
      const cloudResult = await uploadToCloudinary(filePath, "aethra_qrs");
      if (cloudResult.success) {
        qrCodeImage = cloudResult.url;
      } else {
        // Fallback to local base64 storage
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = req.file.mimetype || "image/png";
        const base64Data = fileBuffer.toString("base64");
        qrCodeImage = `data:${mimeType};base64,${base64Data}`;
        
        // Delete temporary file to save space
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
      }
    } catch (err) {
      console.error("Error handling QR file upload:", err);
      qrCodeImage = `/uploads/${req.file.filename}`;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    const userId = req.user.id || "mock_user_id";
    let u = mockUsersDb[userId];
    if (!u) {
      mockUsersDb[userId] = {
        _id: userId,
        id: userId,
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
      };
      u = mockUsersDb[userId];
    }
    if (displayName !== undefined) u.displayName = displayName;
    if (bio !== undefined) u.bio = bio;
    if (location !== undefined) u.location = location;
    if (upiId !== undefined) u.upiId = upiId;
    if (clearQrCodeImage === "true") {
      u.qrCodeImage = "";
    } else if (qrCodeImage !== undefined) {
      u.qrCodeImage = qrCodeImage;
    }
    saveMockUsers();
    return res.json({
      message: "Profile updated successfully (Offline Preview Mode)",
      user: u
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
    const userId = req.user.id || "mock_user_id";
    let u = mockUsersDb[userId];
    if (!u) {
      mockUsersDb[userId] = {
        _id: userId,
        id: userId,
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
      };
      u = mockUsersDb[userId];
    }
    u.hasPremium = true;
    u.subscriptionPlan = planName || "2 Months Boost";
    u.subscriptionExpiresAt = expiresAt;
    saveMockUsers();
    return res.json({
      message: "Subscription activated successfully! (Offline Preview Mode)",
      user: u
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
    const creatorId = req.params.id;
    const myId = req.user.id || "mock_user_id";
    
    if (myId === creatorId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }
    
    let creator = mockUsersDb[creatorId];
    if (!creator) {
      mockUsersDb[creatorId] = {
        _id: creatorId,
        id: creatorId,
        username: "creator_" + creatorId.slice(-4),
        displayName: "Creator " + creatorId.slice(-4),
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
      };
      creator = mockUsersDb[creatorId];
    }
    
    let me = mockUsersDb[myId];
    if (!me) {
      mockUsersDb[myId] = {
        _id: myId,
        id: myId,
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
      };
      me = mockUsersDb[myId];
    }
    
    const isFollowing = me.following.includes(creator._id);
    
    if (isFollowing) {
      me.following = me.following.filter(id => id !== creator._id);
      creator.followers = creator.followers.filter(id => id !== me._id);
    } else {
      me.following.push(creator._id);
      creator.followers.push(me._id);
    }
    
    saveMockUsers();
    return res.json({ 
      message: isFollowing ? "Unfollowed successfully! (Offline Preview Mode)" : "Followed successfully! (Offline Preview Mode)",
      isFollowing: !isFollowing,
      followersCount: creator.followers.length
    });
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

// Get Creator Dashboard Analytics
router.get("/dashboard", auth, async (req, res) => {
  const mongoose = require("mongoose");
  const Post = require("../models/Post");
  const User = require("../models/User");
  
  const creatorId = req.user.id;

  // Fallback if MongoDB is offline
  if (mongoose.connection.readyState !== 1) {
    const myId = creatorId || "mock_user_id";
    const me = (global.mockUsersDb && global.mockUsersDb[myId]) ? global.mockUsersDb[myId] : {
      username: "user", displayName: "User", earnings: 24000
    };

    // Find all creator posts in mockPosts
    const creatorPosts = (global.mockPosts || []).filter(p => {
      const cId = p.creator?._id || p.creator?.id || p.creator;
      return cId && cId.toString() === myId.toString();
    });

    let totalLikes = 0;
    let totalComments = 0;
    let totalSales = 0;
    const postBreakdown = [];

    // Calculate metrics across all posts in mockPosts and mockUsersDb
    creatorPosts.forEach(post => {
      const likesCount = post.likes ? post.likes.length : 0;
      const commentsCount = post.commentsCount || 0;
      
      // Calculate sales by scanning other mock users who purchased it
      let sales = 0;
      if (global.mockUsersDb) {
        Object.values(global.mockUsersDb).forEach(u => {
          if (u._id !== myId && u.id !== myId && u.purchasedPosts && u.purchasedPosts.includes(post._id)) {
            sales++;
          }
        });
      }

      totalLikes += likesCount;
      totalComments += commentsCount;
      totalSales += sales;

      postBreakdown.push({
        _id: post._id,
        title: post.title,
        price: post.price || 0,
        pricing: post.pricing || "free",
        visibility: post.visibility || "public",
        likesCount,
        commentsCount,
        sales,
        earnings: sales * (post.price || 0)
      });
    });

    return res.json({
      totalEarnings: me.earnings || 0,
      totalLikes,
      totalComments,
      totalSales,
      postBreakdown
    });
  }

  try {
    const me = await User.findById(creatorId);
    if (!me) return res.status(404).json({ message: "Creator not found" });

    // Fetch all posts by this creator
    const creatorPosts = await Post.find({ creator: creatorId });

    let totalLikes = 0;
    let totalComments = 0;
    let totalSales = 0;
    const postBreakdown = [];

    for (const post of creatorPosts) {
      const likesCount = post.likes ? post.likes.length : 0;
      const commentsCount = post.commentsCount || 0;

      // Count how many users purchased this post
      const sales = await User.countDocuments({
        _id: { $ne: creatorId }, // exclude self
        purchasedPosts: post._id
      });

      totalLikes += likesCount;
      totalComments += commentsCount;
      totalSales += sales;

      postBreakdown.push({
        _id: post._id,
        title: post.title,
        price: post.price || 0,
        pricing: post.pricing || "free",
        visibility: post.visibility || "public",
        likesCount,
        commentsCount,
        sales,
        earnings: sales * (post.price || 0)
      });
    }

    res.json({
      totalEarnings: me.earnings || 0,
      totalLikes,
      totalComments,
      totalSales,
      postBreakdown
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
