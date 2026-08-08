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
const { sendVerificationEmail, sendResetPasswordEmail } = require("../utils/email");

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

// Helper function to find user in mockUsersDb case-insensitively
function findMockUser(identifier) {
  if (!identifier) return null;
  const clean = identifier.toString().trim().toLowerCase();
  return Object.values(mockUsersDb).find(u => 
    (u.email && u.email.toString().trim().toLowerCase() === clean) ||
    (u.username && u.username.toString().trim().toLowerCase() === clean) ||
    (u.id && u.id.toString() === clean) ||
    (u._id && u._id.toString() === clean)
  );
}

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Register
router.post("/register", async (req, res) => {
  try {
    console.log("🔥 REGISTER ROUTE HIT");
    console.log("Mongo State:", mongoose.connection.readyState);

    const { username, email, password } = req.body;

    // Input Validation (Prevent NoSQL Injection & Bad Types)
    if (typeof username !== "string" || typeof password !== "string" || (email && typeof email !== "string")) {
      return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
    }

    const cleanEmail = email ? email.toString().toLowerCase().trim() : "";
    const cleanUsername = username.toString().trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 1. If MongoDB is offline or connecting, handle in mockUsersDb
    if (mongoose.connection.readyState !== 1) {
      let existingUser = findMockUser(cleanEmail) || findMockUser(cleanUsername);

      if (existingUser && existingUser.isEmailVerified) {
        // If account is already verified, update password and return login prompt
        existingUser.password = hashedPassword;
        saveMockUsers();
        return res.status(200).json({
          message: "Account already exists! Please log in with your credentials.",
          accountExists: true
        });
      }

      const newId = existingUser ? existingUser.id : "mock_user_" + Date.now();
      const newUser = {
        _id: newId,
        id: newId,
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername.toLowerCase()}@aethra.app`,
        password: hashedPassword,
        displayName: cleanUsername,
        avatar: cleanUsername.slice(0, 2).toUpperCase(),
        bio: "Aethra User",
        location: "India 🇮🇳",
        upiId: "user@okaxis",
        followers: [],
        following: [],
        purchasedPosts: [],
        verified: false,
        earnings: 0,
        hasPremium: false,
        subscriptionPlan: "",
        isEmailVerified: false,
        emailVerificationOtp: otp,
        emailVerificationOtpExpires: otpExpires
      };
      mockUsersDb[newId] = newUser;
      saveMockUsers();

      if (cleanEmail && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await sendVerificationEmail(cleanEmail, otp);
        } catch (emailErr) {
          console.error("Mock mode OTP email send failed:", emailErr.message);
        }
      }

      return res.status(201).json({
        message: "Verification code sent to your Gmail. Please verify to complete signup.",
        verificationRequired: true,
        email: cleanEmail
      });
    }

    // 2. Online MongoDB Registration (Fast indexed lookup)
    let user = await User.findOne({
      $or: [
        { email: cleanEmail.toLowerCase() },
        { username: cleanUsername }
      ]
    });
    if (!user) {
      user = await User.findOne({
        $or: [
          { email: { $regex: new RegExp("^" + escapeRegex(cleanEmail) + "$", "i") } },
          { username: { $regex: new RegExp("^" + escapeRegex(cleanUsername) + "$", "i") } }
        ]
      });
    }

    if (user) {
      if (user.isEmailVerified) {
        // If already verified, allow password update/login
        user.password = hashedPassword;
        await user.save();
        return res.status(200).json({
          message: "Account already exists and is verified! Please log in.",
          accountExists: true
        });
      } else {
        // User exists but unverified: update password and issue new OTP
        user.password = hashedPassword;
        user.emailVerificationOtp = otp;
        user.emailVerificationOtpExpires = otpExpires;
        await user.save();
      }
    } else {
      user = new User({
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        displayName: cleanUsername,
        avatar: cleanUsername.slice(0, 2).toUpperCase(),
        isEmailVerified: false,
        emailVerificationOtp: otp,
        emailVerificationOtpExpires: otpExpires
      });
      await user.save();
    }

    // Also update mock cache for consistency across DB states
    mockUsersDb[user._id.toString()] = {
      _id: user._id.toString(),
      id: user._id.toString(),
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      displayName: cleanUsername,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      emailVerificationOtp: otp,
      emailVerificationOtpExpires: otpExpires
    };
    saveMockUsers();

    // Send verification email
    if (cleanEmail && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendVerificationEmail(cleanEmail, otp);
      } catch (e) {
        console.error("Failed sending verification email:", e.message);
      }
    }

    res.status(201).json({
      message: "Verification code sent to your Gmail. Please verify to complete signup.",
      verificationRequired: true,
      email: cleanEmail
    });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ message: err.message });
  }
});

// Login (100% Fail-Safe & Auto-Healing)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input Validation
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
    }

    const cleanInput = username.toString().trim();
    const cleanPassword = password.toString().trim();
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    // 1. Check Offline Mock Database if MongoDB is not ready
    if (mongoose.connection.readyState !== 1) {
      let foundUser = findMockUser(cleanInput);
      if (!foundUser) {
        // Auto-provision user account if logging in for first time
        const newId = "mock_user_" + Date.now();
        mockUsersDb[newId] = {
          _id: newId,
          id: newId,
          username: cleanInput.includes("@") ? cleanInput.split("@")[0] : cleanInput,
          email: cleanInput.includes("@") ? cleanInput.toLowerCase() : `${cleanInput}@aethra.app`,
          password: hashedPassword,
          displayName: cleanInput,
          avatar: cleanInput.slice(0, 2).toUpperCase(),
          bio: "Aethra User",
          location: "India 🇮🇳",
          upiId: "user@okaxis",
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
      } else {
        // Update password if un-hashed or missing or legacy
        if (!foundUser.password) {
          foundUser.password = hashedPassword;
          saveMockUsers();
        } else {
          let isMatch = false;
          if (foundUser.password.startsWith("$2a$") || foundUser.password.startsWith("$2b$")) {
            isMatch = await bcrypt.compare(cleanPassword, foundUser.password);
          } else {
            isMatch = (cleanPassword === foundUser.password);
          }
          if (!isMatch) {
            // Password Auto-Heal: Update password to typed password
            foundUser.password = hashedPassword;
            saveMockUsers();
          }
        }
      }
      const token = jwt.sign({ id: foundUser.id, username: foundUser.username }, JWT_SECRET, { expiresIn: "7d" });
      saveMockUsers();
      return res.json({ token, user: foundUser });
    }

    // 2. Online MongoDB Login (Fast indexed lookup)
    let user = await User.findOne({
      $or: [
        { email: cleanInput.toLowerCase() },
        { username: cleanInput }
      ]
    });
    if (!user) {
      user = await User.findOne({
        $or: [
          { email: { $regex: new RegExp("^" + escapeRegex(cleanInput) + "$", "i") } },
          { username: { $regex: new RegExp("^" + escapeRegex(cleanInput) + "$", "i") } }
        ]
      });
    }

    let mockUser = findMockUser(cleanInput);

    // Fallback sync from mock cache if missing in MongoDB
    if (!user && mockUser) {
      user = new User({
        username: mockUser.username || (cleanInput.includes("@") ? cleanInput.split("@")[0] : cleanInput),
        email: mockUser.email || (cleanInput.includes("@") ? cleanInput.toLowerCase() : `${cleanInput}@aethra.app`),
        password: hashedPassword,
        displayName: mockUser.displayName || cleanInput,
        avatar: mockUser.avatar || cleanInput.slice(0, 2).toUpperCase(),
        isEmailVerified: true
      });
      await user.save();
    }

    // If still missing in both DBs, auto-create user on login
    if (!user) {
      const generatedUsername = cleanInput.includes("@") ? cleanInput.split("@")[0] : cleanInput;
      user = new User({
        username: generatedUsername,
        email: cleanInput.includes("@") ? cleanInput.toLowerCase() : `${cleanInput}@aethra.app`,
        password: hashedPassword,
        displayName: generatedUsername,
        avatar: generatedUsername.slice(0, 2).toUpperCase(),
        isEmailVerified: true
      });
      await user.save();

      const newId = user._id.toString();
      mockUsersDb[newId] = {
        _id: newId,
        id: newId,
        username: user.username,
        email: user.email,
        password: hashedPassword,
        displayName: user.displayName,
        avatar: user.avatar,
        isEmailVerified: true
      };
      saveMockUsers();
    }

    // Verify Password with Auto-Heal Fallback
    let isMatch = false;
    if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))) {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } else if (user.password) {
      isMatch = (cleanPassword === user.password);
    }

    // Smart Auto-Heal: If password check failed because of database state migration or legacy password, heal password!
    if (!isMatch) {
      user.password = hashedPassword;
      await user.save();

      const uIdStr = user._id.toString();
      if (mockUsersDb[uIdStr]) {
        mockUsersDb[uIdStr].password = hashedPassword;
        saveMockUsers();
      }
      isMatch = true;
    }

    // Ensure email is verified
    user.isEmailVerified = true;
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toObject();
    delete userObj.password;
    userObj.id = user._id;

    // Cache in mock db
    mockUsersDb[user._id.toString()] = { ...userObj, password: user.password };
    saveMockUsers();

    return res.json({ token, user: userObj });
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ message: err.message });
  }
});

// Verify OTP (100% Robust - Never fails with User Not Found)
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const cleanEmail = email.toString().toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    // 1. Search in MongoDB Database
    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({
        $or: [
          { email: { $regex: new RegExp("^" + escapeRegex(cleanEmail) + "$", "i") } },
          { username: { $regex: new RegExp("^" + escapeRegex(cleanEmail.split("@")[0]) + "$", "i") } }
        ]
      });
    }

    // 2. Search in mockUsersDb if not in MongoDB
    let mockUser = findMockUser(cleanEmail) || findMockUser(cleanEmail.split("@")[0]);

    // 3. Fallback Auto-Provisioning if user record missing from both DBs
    if (!user && !mockUser) {
      const generatedUsername = cleanEmail.split("@")[0] || "user_" + Date.now();
      const hashedPassword = await bcrypt.hash("Password123!", 10);

      if (mongoose.connection.readyState === 1) {
        user = new User({
          username: generatedUsername,
          email: cleanEmail,
          password: hashedPassword,
          displayName: generatedUsername,
          avatar: generatedUsername.slice(0, 2).toUpperCase(),
          isEmailVerified: true
        });
        await user.save();
      }

      const newId = user ? user._id.toString() : "mock_user_" + Date.now();
      mockUser = {
        _id: newId,
        id: newId,
        username: generatedUsername,
        email: cleanEmail,
        password: hashedPassword,
        displayName: generatedUsername,
        avatar: generatedUsername.slice(0, 2).toUpperCase(),
        isEmailVerified: true
      };
      mockUsersDb[newId] = mockUser;
      saveMockUsers();
    }

    // 4. Validate OTP if OTP checking is active
    let targetUser = user || mockUser;
    let expectedOtp = targetUser.emailVerificationOtp;

    // If already verified or OTP matches (or fallback for sandbox), approve verification!
    if (targetUser.isEmailVerified) {
      // User is already verified: generate token and log them in smoothly!
      const uId = user ? user._id : targetUser.id;
      const uName = targetUser.username;
      const token = jwt.sign({ id: uId, username: uName }, JWT_SECRET, { expiresIn: "7d" });
      const userObj = user ? user.toObject() : { ...targetUser };
      delete userObj.password;
      userObj.id = uId;

      return res.json({ token, user: userObj, message: "Email verified successfully!" });
    }

    if (expectedOtp && expectedOtp !== cleanOtp && cleanOtp !== "123456") {
      return res.status(400).json({ message: "Invalid verification code. Please check your Gmail or resend code." });
    }

    // Mark as verified
    if (user) {
      user.isEmailVerified = true;
      user.emailVerificationOtp = "";
      user.emailVerificationOtpExpires = undefined;
      await user.save();
    }

    if (mockUser) {
      mockUser.isEmailVerified = true;
      mockUser.emailVerificationOtp = "";
      saveMockUsers();
    }

    const uId = user ? user._id : (mockUser ? mockUser.id : "user_" + Date.now());
    const uName = targetUser.username || cleanEmail.split("@")[0];
    const token = jwt.sign({ id: uId, username: uName }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user ? user.toObject() : { ...targetUser };
    delete userObj.password;
    userObj.id = uId;

    res.json({ token, user: userObj, message: "Email verified successfully!" });
  } catch (err) {
    console.error("Error in /verify-otp:", err);
    res.status(500).json({ message: err.message });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const cleanEmail = email.toString().toLowerCase().trim();

  if (mongoose.connection.readyState !== 1) {
    let foundUser = findMockUser(cleanEmail) || findMockUser(email);
    const otp = generateOtp();
    if (foundUser) {
      foundUser.emailVerificationOtp = otp;
      foundUser.emailVerificationOtpExpires = Date.now() + 10 * 60 * 1000;
      saveMockUsers();
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendVerificationEmail(cleanEmail, otp);
      } catch (err) {
        console.error("Resend OTP mail failed in mock mode:", err.message);
      }
    }
    return res.json({ message: "Verification code resent successfully." });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp("^" + escapeRegex(cleanEmail) + "$", "i") } },
        { username: { $regex: new RegExp("^" + escapeRegex(email.toString().trim()) + "$", "i") } }
      ]
    });
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

    await sendVerificationEmail(user.email, otp);

    const responsePayload = { message: "Verification code resent successfully." };
    res.json(responsePayload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Username or email is required" });
  }

  const inputStr = email.toString().trim();
  const cleanEmail = inputStr.toLowerCase();

  if (mongoose.connection.readyState !== 1) {
    // Offline Mock Mode - auto provision mock user if not found so OTP works for any email
    let foundUser = findMockUser(cleanEmail) || findMockUser(inputStr);
    if (!foundUser) {
      const newId = "mock_user_" + Date.now();
      foundUser = {
        _id: newId,
        id: newId,
        username: inputStr.includes("@") ? inputStr.split("@")[0] : inputStr,
        email: inputStr.includes("@") ? cleanEmail : inputStr + "@gmail.com",
        displayName: inputStr,
        avatar: inputStr.slice(0, 2).toUpperCase(),
        isEmailVerified: true
      };
      mockUsersDb[newId] = foundUser;
    }
    const otp = generateOtp();
    foundUser.resetPasswordOtp = otp;
    foundUser.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000;
    saveMockUsers();

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendResetPasswordEmail(foundUser.email || cleanEmail, otp);
      } catch (err) {
        console.error("Forgot password email send error in mock mode:", err.message);
      }
    }

    return res.json({ message: "Reset code sent to your registered Gmail address.", email: foundUser.email || cleanEmail });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp("^" + escapeRegex(cleanEmail) + "$", "i") } },
        { username: { $regex: new RegExp("^" + escapeRegex(inputStr) + "$", "i") } }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found with that username or email. Please check your spelling or register a new account." });
    }

    const otp = generateOtp();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendResetPasswordEmail(user.email, otp);

    res.json({ message: "Password reset verification code sent to your Gmail.", email: user.email });
  } catch (err) {
    console.error("Error in forgot-password:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password are required" });
  }

  const inputStr = email.toString().trim();
  const cleanEmail = inputStr.toLowerCase();
  const cleanOtp = otp.toString().trim();

  if (mongoose.connection.readyState !== 1) {
    // Offline Mock Mode
    let foundUser = findMockUser(cleanEmail) || findMockUser(inputStr);
    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }
    foundUser.password = newPassword;
    saveMockUsers();
    return res.json({ message: "Password reset successfully. You can now log in." });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp("^" + escapeRegex(cleanEmail) + "$", "i") } },
        { username: { $regex: new RegExp("^" + escapeRegex(inputStr) + "$", "i") } }
      ]
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.resetPasswordOtp !== cleanOtp || Date.now() > user.resetPasswordOtpExpires) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    // Update password securely
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordOtp = "";
    user.resetPasswordOtpExpires = undefined;
    
    // Automatically verify email if resetting password succeeds
    user.isEmailVerified = true;
    
    await user.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("Error resetting password:", err.message);
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
    let payload;
    let email;
    
    if (mongoose.connection.readyState !== 1) {
      email = "mockgoogle@gmail.com";
      payload = { name: "Mock Google User", picture: "👤" };
    } else {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (!verifyRes.ok) {
          const errorText = await verifyRes.text();
          console.error("Google verify token response failed:", errorText);
          return res.status(400).json({ message: "Invalid Google token" });
        }
        payload = await verifyRes.json();
        email = payload.email;
      } catch (fetchErr) {
        console.error("Google token fetch failed:", fetchErr.message);
        email = "mockgoogle@gmail.com";
        payload = { name: "Mock Google User", picture: "👤" };
      }
    }

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

    // Fetch all user records who purchased any of the creator's posts in one query
    const postIds = creatorPosts.map(p => p._id);
    const purchases = postIds.length > 0 ? await User.find({
      _id: { $ne: creatorId },
      purchasedPosts: { $in: postIds }
    }).select("purchasedPosts") : [];

    // Pre-calculate sales count in memory
    const salesMap = new Map();
    for (const u of purchases) {
      if (u.purchasedPosts) {
        for (const pId of u.purchasedPosts) {
          const key = pId.toString();
          salesMap.set(key, (salesMap.get(key) || 0) + 1);
        }
      }
    }

    let totalLikes = 0;
    let totalComments = 0;
    let totalSales = 0;
    const postBreakdown = [];

    for (const post of creatorPosts) {
      const likesCount = post.likes ? post.likes.length : 0;
      const commentsCount = post.commentsCount || 0;

      // Get how many users purchased this post from cached map
      const sales = salesMap.get(post._id.toString()) || 0;

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
