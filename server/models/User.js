const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  displayName: { type: String, default: "" },
  avatar: { type: String, default: "👤" },
  bio: { type: String, default: "" },
  location: { type: String, default: "India 🇮🇳" },
  upiId: { type: String, default: "" },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  purchasedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  verified: { type: Boolean, default: false },
  earnings: { type: Number, default: 0 },
  hasPremium: { type: Boolean, default: false },
  subscriptionPlan: { type: String, default: "" },
  subscriptionExpiresAt: { type: Date },
  qrCodeImage: { type: String, default: "" },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationOtp: { type: String, default: "" },
  emailVerificationOtpExpires: { type: Date },
  isGoogleUser: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);