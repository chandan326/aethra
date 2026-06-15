const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "aethrasecretkey_change_in_production";
const mongoose = require("mongoose");

module.exports = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // If MongoDB is connected or connecting, reject any mock user ID to force a fresh login/register
    const state = mongoose.connection.readyState;
    const isMockUser = decoded.id === "mock_user_id" || (typeof decoded.id === "string" && decoded.id.startsWith("mock_user_"));
    if ((state === 1 || state === 2) && isMockUser) {
      return res.status(401).json({ message: "Offline preview session. Please log out and sign up/log in again." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};
