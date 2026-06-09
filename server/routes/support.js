const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const SupportTicket = require("../models/SupportTicket");

// Submit support ticket
router.post("/", async (req, res) => {
  const { name, email, subject, category, message } = req.body;

  if (!name || !email || !subject || !category || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const ticketId = "TKT-" + Math.floor(100000 + Math.random() * 900000);

  // Fallback if MongoDB is offline
  if (mongoose.connection.readyState !== 1) {
    return res.status(201).json({
      message: "Support ticket submitted successfully (Offline Preview Mode)",
      ticket: {
        id: ticketId,
        name,
        email,
        subject,
        category,
        message,
        status: "open",
        createdAt: new Date()
      }
    });
  }

  try {
    const ticket = new SupportTicket({
      name,
      email,
      subject,
      category,
      message
    });
    await ticket.save();

    res.status(201).json({
      message: "Support ticket submitted successfully!",
      ticket: {
        id: ticket._id,
        name: ticket.name,
        email: ticket.email,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
