const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  handle: { type: String, required: true, unique: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "📺" },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

ChannelSchema.index({ owner: 1 });

module.exports = mongoose.model("Channel", ChannelSchema);
