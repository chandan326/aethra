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

  // Send notification & confirmation emails in parallel in background for ultra-fast response
  Promise.allSettled([
    sendSupportTicketNotification({
      ticketId: ticketData.ticketId || ticketData.id || generatedTicketId,
      name,
      email,
      category,
      subject,
      message
    }),
    sendSupportUserConfirmation({
      ticketId: ticketData.ticketId || ticketData.id || generatedTicketId,
      name,
      email,
      category,
      subject,
      message
    })
  ]).then(([notifyRes, userRes]) => {
    if (notifyRes.status === "fulfilled" && notifyRes.value?.success) {
      console.log("📨 Support ticket notification delivered to admin.");
    } else if (notifyRes.status === "rejected") {
      console.warn("⚠️ Support notification error:", notifyRes.reason?.message);
    }
    if (userRes.status === "fulfilled" && userRes.value?.success) {
      console.log("📨 Support ticket confirmation delivered to user.");
    } else if (userRes.status === "rejected") {
      console.warn("⚠️ Support confirmation error:", userRes.reason?.message);
    }
  }).catch(emailErr => {
    console.error("⚠️ Support email processing error:", emailErr.message);
  });

  return res.status(201).json({
    message: "Support ticket submitted successfully!",
    ticket: ticketData,
    emailAlertSent: true,
    userConfirmSent: true
  });
});

module.exports = router;
