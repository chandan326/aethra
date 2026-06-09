const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, required: true, trim: true },
  category: { type: String, required: true, default: "technical" },
  message: { type: String, required: true },
  status: { type: String, default: "open", enum: ["open", "in-progress", "resolved", "closed"] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
