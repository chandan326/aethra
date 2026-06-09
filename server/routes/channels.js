const express = require("express");
const router = express.Router();
const Channel = require("../models/Channel");
const auth = require("../middleware/auth");

const mockChannels = [
  { _id: "c1", name: "ArtHive Studio", handle: "artby_meera", owner: { _id: "u1", id: "u1", username: "artby_meera", displayName: "Meera Art", avatar: "🎨", verified: true, hasPremium: true }, description: "Weekly AI art drops, tutorials & behind the scenes of digital creation.", icon: "🎨", subscribers: ["u1"] },
  { _id: "c2", name: "Cosmic Creations", handle: "space_vfx", owner: { _id: "u9", id: "u9", username: "space_vfx", displayName: "SpaceVFX", avatar: "🌌", verified: true, hasPremium: true }, description: "Space, sci-fi & surreal AI art. New posts every Tuesday & Friday.", icon: "🌌", subscribers: [] },
  { _id: "c3", name: "Dragon Forge", handle: "mythcraft_rohit", owner: { _id: "u10", id: "u10", username: "mythcraft_rohit", displayName: "MythCraft", avatar: "🐉", verified: true }, description: "Fantasy creatures, mythological AI art & epic GIF animations.", icon: "🐉", subscribers: [] },
  { _id: "c4", name: "Kawaii World", handle: "pixel_priya", owner: { _id: "u3", id: "u3", username: "pixel_priya", displayName: "Pixel Priya", avatar: "🌸", verified: true }, description: "Cute stickers, anime-inspired AI art and aesthetic GIF collections.", icon: "🌸", subscribers: [] },
  { _id: "c5", name: "Neon District", handle: "cyberpunk_dev", owner: { _id: "u11", id: "u11", username: "cyberpunk_dev", displayName: "Neon Dev", avatar: "⚡", verified: true }, description: "Cyberpunk art, neon aesthetics & futuristic digital visuals.", icon: "⚡", subscribers: [] },
  { _id: "c6", name: "Aperture Club", handle: "lens_lens", owner: { _id: "u12", id: "u12", username: "lens_lens", displayName: "Lens & Shutter", avatar: "📸", verified: true }, description: "Breathtaking photography, camera presets, and guides.", icon: "📸", subscribers: [] },
  { _id: "c7", name: "Sticker Paradise", handle: "catlife", owner: { _id: "u7", id: "u7", username: "catlife", displayName: "Cat Life", avatar: "😺", verified: true }, description: "Sticker sets, vector assets and fun graphics.", icon: "😺", subscribers: [] },
  { _id: "c8", name: "Synth Wave 3D", handle: "synth_3d", owner: { _id: "u13", id: "u13", username: "synth_3d", displayName: "AI Avanti", avatar: "🤖", verified: true, hasPremium: true }, description: "3D characters, cyberpunk loops and high-fidelity textures.", icon: "🤖", subscribers: [] }
];

// Get all channels
router.get("/", async (req, res) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    return res.json(mockChannels);
  }
  try {
    const channels = await Channel.find()
      .populate("owner", "username displayName avatar verified hasPremium qrCodeImage")
      .sort({ createdAt: -1 });
    res.json(channels);
  } catch (err) {
    res.json(mockChannels);
  }
});

// Create a channel
router.post("/", auth, async (req, res) => {
  try {
    const { name, handle, description, icon } = req.body;
    
    // Type checking to prevent NoSQL injection / object payloads
    if (typeof name !== "string" || typeof handle !== "string" || (description && typeof description !== "string") || (icon && typeof icon !== "string")) {
      return res.status(400).json({ message: "Invalid input types. Fields must be strings." });
    }
    
    // Check if handle is already taken
    const existing = await Channel.findOne({ handle });
    if (existing) return res.status(400).json({ message: "Channel handle already in use" });

    const channel = new Channel({
      name,
      handle,
      owner: req.user.id,
      description,
      icon: icon || "📺"
    });

    await channel.save();
    res.status(201).json(channel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle Subscribe
router.post("/:id/subscribe", auth, async (req, res) => {
  const mongoose = require("mongoose");
  
  if (mongoose.connection.readyState !== 1) {
    const channelId = req.params.id;
    const myId = req.user.id || "mock_user_id";
    
    const channel = mockChannels.find(c => c._id === channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    
    const ownerId = channel.owner?._id || channel.owner?.id || "";
    if (ownerId.toString() === myId.toString()) {
      return res.status(400).json({ message: "You cannot subscribe to your own channel" });
    }
    
    if (!channel.subscribers) channel.subscribers = [];
    const index = channel.subscribers.indexOf(myId);
    if (index === -1) {
      channel.subscribers.push(myId);
    } else {
      channel.subscribers.splice(index, 1);
    }
    
    return res.json({ subscribersCount: channel.subscribers.length, isSubscribed: channel.subscribers.includes(myId) });
  }

  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.owner.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot subscribe to your own channel" });
    }

    const index = channel.subscribers.indexOf(req.user.id);
    if (index === -1) {
      channel.subscribers.push(req.user.id);
    } else {
      channel.subscribers.splice(index, 1);
    }

    await channel.save();
    res.json({ subscribersCount: channel.subscribers.length, isSubscribed: channel.subscribers.includes(req.user.id) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
