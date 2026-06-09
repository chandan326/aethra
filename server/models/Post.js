const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  content: { type: String, required: true }, // Emoji or filename/path
  contentType: { type: String, required: true }, // 'AI', 'GIF', 'STICKER', 'Digital Art', 'Photography'
  visibility: { type: String, default: "public" }, // 'public', 'private', 'followers'
  pricing: { type: String, default: "free" }, // 'free', 'paid', 'subscribers'
  price: { type: Number, default: 0 },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  commentsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", PostSchema);
