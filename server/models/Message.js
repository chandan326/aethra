const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: String, required: true }, // Can be user ID string or "aethra"
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, sender: 1 });
messageSchema.index({ createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
