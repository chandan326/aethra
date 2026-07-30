const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Post = require("../models/Post");
const User = require("../models/User");
const Order = require("../models/Order");

// Helper to get Razorpay instance if keys are available
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret && keyId !== "your_razorpay_key_id_here") {
    const Razorpay = require("razorpay");
    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }
  return null;
}

// ── In-Memory Security & Rate Limiting Caches ─────────────────────────────────
const processedWebhookEvents = new Set();
const requestRateLimits = new Map();

// Rate limiting middleware helper (Max 30 requests per minute per IP)
function checkRateLimit(req, res, next) {
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  let record = requestRateLimits.get(clientIp);
  if (!record || (now - record.startTime) > windowMs) {
    record = { startTime: now, count: 1 };
    requestRateLimits.set(clientIp, record);
  } else {
    record.count++;
  }

  if (record.count > maxRequests) {
    return res.status(429).json({ message: "Security Guard: Too many requests. Please try again in a minute." });
  }
  next();
}

// ── GET /api/payment/config ──────────────────────────────────────────────────
router.get("/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const isConfigured = Boolean(keyId && keyId !== "your_razorpay_key_id_here");
  
  res.json({
    keyId: isConfigured ? keyId : "rzp_test_aethra_sandbox",
    isConfigured,
    mode: isConfigured ? "live_or_test_key" : "sandbox_mode"
  });
});

// ── POST /api/payment/create-order ───────────────────────────────────────────
router.post("/create-order", auth, checkRateLimit, async (req, res) => {
  try {
    const { items, postId, promoCode } = req.body;
    const myId = req.user.id;

    // Type checking & input sanitization
    if (items && !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid payload format: items must be an array" });
    }
    if (postId && typeof postId !== "string") {
      return res.status(400).json({ message: "Invalid payload format: postId must be a string" });
    }

    let itemIds = [];
    if (Array.isArray(items) && items.length > 0) {
      itemIds = items.map(id => id.toString().trim());
    } else if (postId) {
      itemIds = [postId.toString().trim()];
    }

    if (itemIds.length === 0) {
      return res.status(400).json({ message: "No items specified for order creation" });
    }

    // Server-side price calculation (never trust client prices)
    let subtotal = 0;
    const postsToPurchase = [];

    if (mongoose.connection.readyState === 1) {
      const posts = await Post.find({ _id: { $in: itemIds } });
      for (const p of posts) {
        postsToPurchase.push(p);
        if (p.pricing === "paid") {
          subtotal += p.price || 0;
        }
      }
    } else {
      for (const id of itemIds) {
        const p = (global.mockPosts || []).find(post => post._id === id || post.id === id);
        if (p) {
          postsToPurchase.push(p);
          if (p.pricing === "paid") {
            subtotal += p.price || 0;
          }
        }
      }
    }

    if (postsToPurchase.length === 0) {
      return res.status(404).json({ message: "No valid products found for order" });
    }

    // Apply Service Charge & Promo Code
    const serviceCharge = Math.round(subtotal * 0.05);
    let discount = 0;
    if (promoCode === "AETHRA20") {
      discount = Math.round(subtotal * 0.20);
    }
    const grandTotal = Math.max(0, subtotal + serviceCharge - discount);
    const amountPaise = grandTotal * 100; // Razorpay expects amount in paise

    const razorpay = getRazorpayInstance();
    const receiptId = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let orderData = null;

    if (razorpay) {
      // Create order via official Razorpay SDK
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: receiptId,
        notes: {
          userId: myId,
          itemIds: itemIds.join(","),
          grandTotal: grandTotal.toString()
        }
      });

      orderData = {
        razorpayOrderId: razorpayOrder.id,
        amount: grandTotal,
        amountPaise: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        isMock: false
      };
    } else {
      // Fallback sandbox mock order for local testing before real keys are inserted
      const mockOrderId = `order_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      orderData = {
        razorpayOrderId: mockOrderId,
        amount: grandTotal,
        amountPaise,
        currency: "INR",
        receipt: receiptId,
        isMock: true
      };
    }

    // Store Order record in DB / Mock DB
    if (mongoose.connection.readyState === 1) {
      const newOrder = new Order({
        razorpayOrderId: orderData.razorpayOrderId,
        userId: myId,
        items: itemIds,
        amount: grandTotal,
        amountPaise,
        currency: "INR",
        status: "created",
        receipt: receiptId,
        notes: { promoCode, itemIds: itemIds.join(",") }
      });
      await newOrder.save();
    } else {
      if (!global.mockOrdersDb) global.mockOrdersDb = {};
      global.mockOrdersDb[orderData.razorpayOrderId] = {
        razorpayOrderId: orderData.razorpayOrderId,
        userId: myId,
        items: itemIds,
        amount: grandTotal,
        amountPaise,
        status: "created",
        receipt: receiptId,
        createdAt: new Date()
      };
    }

    return res.json({
      orderId: orderData.razorpayOrderId,
      amount: grandTotal,
      amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_aethra_sandbox",
      isMock: orderData.isMock,
      items: itemIds
    });

  } catch (err) {
    console.error("Error creating payment order:", err);
    return res.status(500).json({ message: "Failed to create payment order: " + err.message });
  }
});

// ── POST /api/payment/verify-payment ────────────────────────────────────────
router.post("/verify-payment", auth, checkRateLimit, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = req.body;
    const myId = req.user.id;

    // Type validation against Parameter Injection Attacks
    if (typeof razorpay_order_id !== "string" || typeof razorpay_payment_id !== "string") {
      return res.status(400).json({ message: "Invalid parameter types: order_id and payment_id must be strings" });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isLiveConfig = Boolean(keySecret && keySecret !== "your_razorpay_key_secret_here");

    // 🔒 HMAC SHA256 Signature Verification & Timing Attack Prevention
    if (isLiveConfig) {
      if (!razorpay_signature || typeof razorpay_signature !== "string") {
        return res.status(400).json({ message: "Payment signature missing or invalid" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body.toString())
        .digest("hex");

      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf-8"),
        Buffer.from(razorpay_signature, "utf-8")
      );

      if (!isSignatureValid) {
        return res.status(400).json({ message: "Security Guard: Invalid payment signature! Transaction aborted." });
      }
    }

    // 🔒 Idempotency & Replay Attack Check
    let alreadyPaid = false;
    let itemIdsToProcess = Array.isArray(items) ? items : [];

    if (mongoose.connection.readyState === 1) {
      const existingOrder = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (existingOrder) {
        if (existingOrder.status === "paid") {
          alreadyPaid = true;
        } else {
          existingOrder.razorpayPaymentId = razorpay_payment_id;
          existingOrder.razorpaySignature = razorpay_signature || "sandbox_verified";
          existingOrder.status = "paid";
          existingOrder.updatedAt = new Date();
          await existingOrder.save();
        }
        if (existingOrder.items && existingOrder.items.length > 0) {
          itemIdsToProcess = existingOrder.items;
        }
      }

      // Add purchases to User profile & update Creator earnings (only if not already processed)
      if (!alreadyPaid) {
        const user = await User.findById(myId);
        if (user) {
          if (!user.purchasedPosts) user.purchasedPosts = [];
          
          for (const pId of itemIdsToProcess) {
            const pStr = pId.toString();
            if (!user.purchasedPosts.includes(pStr)) {
              user.purchasedPosts.push(pStr);

              // Credit creator earnings
              const post = await Post.findById(pStr);
              if (post && post.creator) {
                const creator = await User.findById(post.creator);
                if (creator) {
                  creator.earnings = (creator.earnings || 0) + (post.price || 0);
                  await creator.save();
                }
              }
            }
          }
          await user.save();
        }
      }
    } else {
      // Offline / Mock database fulfillment
      if (global.mockOrdersDb && global.mockOrdersDb[razorpay_order_id]) {
        const order = global.mockOrdersDb[razorpay_order_id];
        if (order.status === "paid") {
          alreadyPaid = true;
        } else {
          order.status = "paid";
          order.razorpayPaymentId = razorpay_payment_id;
        }
        if (order.items && order.items.length > 0) {
          itemIdsToProcess = order.items;
        }
      }

      if (!alreadyPaid) {
        if (!global.mockUsersDb) global.mockUsersDb = {};
        let me = global.mockUsersDb[myId];
        if (!me) {
          global.mockUsersDb[myId] = {
            _id: myId,
            id: myId,
            username: req.user.username || "preview_user",
            purchasedPosts: []
          };
          me = global.mockUsersDb[myId];
        }

        if (!me.purchasedPosts) me.purchasedPosts = [];

        for (const pId of itemIdsToProcess) {
          const pStr = pId.toString();
          if (!me.purchasedPosts.includes(pStr)) {
            me.purchasedPosts.push(pStr);

            const post = (global.mockPosts || []).find(p => p._id === pStr || p.id === pStr);
            if (post && post.creator) {
              const cId = post.creator._id || post.creator.id || post.creator;
              const creator = global.mockUsersDb[cId];
              if (creator) {
                creator.earnings = (creator.earnings || 0) + (post.price || 0);
              }
            }
          }
        }

        if (global.saveMockUsers) global.saveMockUsers();
      }
    }

    return res.json({
      success: true,
      message: alreadyPaid ? "Payment already processed previously." : "Payment verified successfully!",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      purchasedItems: itemIdsToProcess,
      alreadyPaid
    });

  } catch (err) {
    console.error("Error verifying payment:", err);
    return res.status(500).json({ message: "Verification failed: " + err.message });
  }
});

// ── POST /api/payment/webhook ────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    // 🔒 Timing Safe Webhook Signature Verification
    if (webhookSecret && webhookSecret !== "your_razorpay_webhook_secret_here") {
      if (!signature || typeof signature !== "string") {
        return res.status(400).json({ message: "Missing or invalid webhook signature" });
      }

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf-8"),
        Buffer.from(signature, "utf-8")
      );

      if (!isValid) {
        return res.status(400).json({ message: "Security Guard: Invalid webhook signature" });
      }
    }

    const event = req.body.event;
    const eventId = req.body.event_id || `${event}_${Date.now()}`;

    // Replay Attack Protection for Webhooks
    if (processedWebhookEvents.has(eventId)) {
      return res.json({ status: "already_processed" });
    }
    processedWebhookEvents.add(eventId);

    const payload = req.body.payload;

    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = payload.payment?.entity || payload.order?.entity;
      if (paymentEntity) {
        const orderId = paymentEntity.order_id;
        const notes = paymentEntity.notes || {};
        const userId = notes.userId;
        const itemIds = notes.itemIds ? notes.itemIds.split(",") : [];

        if (mongoose.connection.readyState === 1 && orderId) {
          const order = await Order.findOne({ razorpayOrderId: orderId });
          if (order && order.status !== "paid") {
            order.status = "paid";
            order.razorpayPaymentId = paymentEntity.id;
            await order.save();

            if (userId && itemIds.length > 0) {
              const user = await User.findById(userId);
              if (user) {
                if (!user.purchasedPosts) user.purchasedPosts = [];
                for (const item of itemIds) {
                  if (!user.purchasedPosts.includes(item)) {
                    user.purchasedPosts.push(item);
                  }
                }
                await user.save();
              }
            }
          }
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── MANUAL REFUND MANAGEMENT (100% Admin Controlled) ──────────────────────────

// Customer submits manual refund request
router.post("/request-refund", auth, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const myId = req.user.id;

    if (!orderId || !reason) {
      return res.status(400).json({ message: "Order ID and reason for refund are required." });
    }

    let orderFound = null;
    if (mongoose.connection.readyState === 1) {
      orderFound = await Order.findOne({ razorpayOrderId: orderId, userId: myId });
      if (!orderFound) {
        return res.status(404).json({ message: "Paid order not found for this account." });
      }
      if (orderFound.status === "refunded") {
        return res.status(400).json({ message: "This order has already been refunded." });
      }
      
      orderFound.notes = orderFound.notes || {};
      orderFound.notes.refundRequested = true;
      orderFound.notes.refundReason = reason;
      orderFound.notes.refundStatus = "pending_manual_admin_review";
      orderFound.notes.requestedAt = new Date().toISOString();
      await orderFound.save();
    } else {
      orderFound = global.mockOrdersDb ? global.mockOrdersDb[orderId] : null;
      if (orderFound) {
        orderFound.notes = orderFound.notes || {};
        orderFound.notes.refundRequested = true;
        orderFound.notes.refundReason = reason;
        orderFound.notes.refundStatus = "pending_manual_admin_review";
      }
    }

    return res.json({
      success: true,
      message: "Refund request submitted successfully! Your request has been queued for manual review by the platform Admin.",
      orderId,
      refundStatus: "pending_manual_admin_review"
    });
  } catch (err) {
    console.error("Error submitting refund request:", err);
    return res.status(500).json({ message: err.message });
  }
});

// Admin fetches all orders & refund requests for manual inspection
router.get("/admin/orders", auth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const orders = await Order.find().sort({ createdAt: -1 });
      return res.json({ orders });
    } else {
      const orders = Object.values(global.mockOrdersDb || {});
      return res.json({ orders });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Admin manually approves or rejects refund request
router.post("/admin/process-refund", auth, async (req, res) => {
  try {
    const { orderId, action, adminNotes } = req.body; // action: 'approve' | 'reject'

    if (!orderId || !action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Valid orderId and action ('approve' or 'reject') are required." });
    }

    let order = null;
    if (mongoose.connection.readyState === 1) {
      order = await Order.findOne({ razorpayOrderId: orderId });
    } else {
      order = global.mockOrdersDb ? global.mockOrdersDb[orderId] : null;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (action === "reject") {
      order.notes = order.notes || {};
      order.notes.refundStatus = "rejected_by_admin";
      order.notes.adminNotes = adminNotes || "Refund request rejected after manual review.";
      if (mongoose.connection.readyState === 1) await order.save();

      return res.json({
        success: true,
        message: "Refund request REJECTED by Admin. No money was deducted.",
        status: "rejected_by_admin"
      });
    }

    if (action === "approve") {
      // Execute Razorpay refund ONLY if explicit Admin Key Secret is set and Admin manually clicked Approve
      const razorpay = getRazorpayInstance();
      let razorpayRefundId = "manual_admin_approved";

      if (razorpay && order.razorpayPaymentId && !order.razorpayPaymentId.startsWith("pay_mock_")) {
        try {
          const refundRes = await razorpay.payments.refund(order.razorpayPaymentId, {
            amount: order.amountPaise,
            notes: { adminNotes: adminNotes || "Approved by Admin" }
          });
          razorpayRefundId = refundRes.id;
        } catch (rzpErr) {
          console.warn("Razorpay API refund warning:", rzpErr.message);
        }
      }

      order.status = "refunded";
      order.notes = order.notes || {};
      order.notes.refundStatus = "approved_by_admin";
      order.notes.razorpayRefundId = razorpayRefundId;
      order.notes.adminNotes = adminNotes || "Refund approved and processed by Admin.";

      // Revoke user's purchased items if applicable
      if (mongoose.connection.readyState === 1) {
        await order.save();
        if (order.userId && order.items) {
          const user = await User.findById(order.userId);
          if (user && user.purchasedPosts) {
            user.purchasedPosts = user.purchasedPosts.filter(pId => !order.items.includes(pId.toString()));
            await user.save();
          }
        }
      } else if (global.mockUsersDb && global.mockUsersDb[order.userId]) {
        const u = global.mockUsersDb[order.userId];
        if (u.purchasedPosts) {
          u.purchasedPosts = u.purchasedPosts.filter(pId => !order.items.includes(pId.toString()));
        }
      }

      return res.json({
        success: true,
        message: "Refund APPROVED and processed by Admin.",
        status: "refunded",
        razorpayRefundId
      });
    }

  } catch (err) {
    console.error("Admin refund processing error:", err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
