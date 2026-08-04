const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const SupportTicket = require("../models/SupportTicket");

const { sendSupportTicketNotification, sendSupportUserConfirmation } = require("../utils/email");

// Submit support ticket
router.post("/", async (req, res) => {
  const { name, email, subject, category, message } = req.body;

  if (!name || !email || !subject || !category || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Type validation to prevent type-injection and object payload bypasses
  if (typeof name !== "string" || typeof email !== "string" || typeof subject !== "string" || typeof category !== "string" || typeof message !== "string") {
    return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
  }

  const generatedTicketId = "TKT-" + Math.floor(100000 + Math.random() * 900000);
  let ticketData = null;

  // Fallback if MongoDB is offline
  if (mongoose.connection.readyState !== 1) {
    ticketData = {
      id: generatedTicketId,
      name,
      email,
      subject,
      category,
      message,
      status: "open",
      createdAt: new Date()
    };
  } else {
    try {
      const ticket = new SupportTicket({
        name,
        email,
        subject,
        category,
        message
      });
      await ticket.save();
      ticketData = {
        id: ticket._id,
        ticketId: generatedTicketId,
        name: ticket.name,
        email: ticket.email,
        subject: ticket.subject,
        category: ticket.category,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.createdAt
      };
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  let emailAlertSent = false;
  let userConfirmSent = false;

  // Send notification to Technical Support (can.yamn0020@gmail.com)
  try {
    const notifyRes = await sendSupportTicketNotification({
      ticketId: ticketData.ticketId || ticketData.id || generatedTicketId,
      name,
      email,
      category,
      subject,
      message
    });
    if (notifyRes && notifyRes.success) {
      emailAlertSent = true;
    }
  } catch (emailErr) {
    console.error("⚠️ Failed to send notification email to technical support:", emailErr.message);
  }

  // Send confirmation to user
  try {
    const userRes = await sendSupportUserConfirmation({
      ticketId: ticketData.ticketId || ticketData.id || generatedTicketId,
      name,
      email,
      category,
      subject,
      message
    });
    if (userRes && userRes.success) {
      userConfirmSent = true;
    }
  } catch (userEmailErr) {
    console.error("⚠️ Failed to send confirmation email to user:", userEmailErr.message);
  }

  return res.status(201).json({
    message: "Support ticket submitted successfully!",
    ticket: ticketData,
    emailAlertSent,
    userConfirmSent
  });
});

module.exports = router;
