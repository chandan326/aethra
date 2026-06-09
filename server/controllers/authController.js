
console.log("🔥 AUTH CONTROLLER LOADED");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
console.log("🔥 REGISTER USER FUNCTION CALLED");
const registerUser = async (req, res) => {
    console.log("🚀 REGISTER API HIT");
console.log(req.body);
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });

    res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = { registerUser };