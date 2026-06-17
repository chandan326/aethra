const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "aethrasecretkey_change_in_production";
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

module.exports = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // If MongoDB is connected and token is a mock user token, dynamically map it to a persistent database preview user
    const state = mongoose.connection.readyState;
    const isMockUser = decoded.id === "mock_user_id" || (typeof decoded.id === "string" && decoded.id.startsWith("mock_user_"));
    
    if (state === 1 && isMockUser) {
      try {
        let user = await User.findOne({ username: "preview_user" });
        if (!user) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash("preview_pass_123", salt);
          user = new User({
            username: "preview_user",
            email: "preview_user@aethra.app",
            password: hashedPassword,
            displayName: "Preview User",
            avatar: "PR",
            bio: "Persistent database preview user",
            verified: true,
            isEmailVerified: true
          });
          await user.save();
        }
        
        req.user = {
          id: user._id.toString(),
          username: user.username
        };
        return next();
      } catch (dbErr) {
        console.error("Failed to dynamically map mock user in auth middleware:", dbErr);
        req.user = decoded;
        return next();
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};
