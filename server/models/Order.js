const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  razorpayOrderId: {
    type: String,
    required: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    default: ""
  },
  razorpaySignature: {
    type: String,
    default: ""
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [
    {
      type: String,
      required: true
    }
  ],
  amount: {
    type: Number,
    required: true
  },
  amountPaise: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: "INR"
  },
  status: {
    type: String,
    enum: ["created", "paid", "failed", "refunded"],
    default: "created"
  },
  receipt: {
    type: String
  },
  notes: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);
