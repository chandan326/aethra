const express = require("express");
const router = express.Router();
const Channel = require("../models/Channel");
const auth = require("../middleware/auth");

const mockChannels = [
  { _id: "c1", name: "ArtHive Studio", handle: "artby_meera", owner: { username: "artby_meera", displayName: "Meera Art", avatar: "🎨", verified: true, hasPremium: true }, description: "Weekly AI art drops, tutorials & behind the scenes of digital creation.", icon: "🎨", subscribers: ["u1"] },
  { _id: "c2", name: "Cosmic Creations", handle: "space_vfx", owner: { username: "space_vfx", displayName: "SpaceVFX", avatar: "🌌", verified: true, hasPremium: true }, description: "Space, sci-fi & surreal AI art. New posts every Tuesday & Friday.", icon: "🌌", subscribers: [] },
  { _id: "c3", name: "Dragon Forge", handle: "mythcraft_rohit", owner: { username: "mythcraft_rohit", displayName: "MythCraft", avatar: "🐉", verified: true }, description: "Fantasy creatures, mythological AI art & epic GIF animations.", icon: "🐉", subscribers: [] },
  { _id: "c4", name: "Kawaii World", handle: "pixel_priya", owner: { username: "pixel_priya", displayName: "Pixel Priya", avatar: "🌸", verified: true }, description: "Cute stickers, anime-inspired AI art and aesthetic GIF collections.", icon: "🌸", subscribers: [] },
  { _id: "c5", name: "Neon District", handle: "cyberpunk_dev", owner: { username: "cyberpunk_dev", displayName: "Neon Dev", avatar: "⚡", verified: true }, description: "Cyberpunk art, neon aesthetics & futuristic digital visuals.", icon: "⚡", subscribers: [] },
  { _id: "c6", name: "Aperture Club", handle: "lens_lens", owner: { username: "lens_lens", displayName: "Lens & Shutter", avatar: "📸", verified: true }, description: "Breathtaking photography, camera presets, and guides.", icon: "📸", subscribers: [] },
  { _id: "c7", name: "Sticker Paradise", handle: "catlife", owner: { username: "catlife", displayName: "Cat Life", avatar: "😺", verified: true }, description: "Sticker sets, vector assets and fun graphics.", icon: "😺", subscribers: [] },
  { _id: "c8", name: "Synth Wave 3D", handle: "synth_3d", owner: { username: "synth_3d", displayName: "AI Avanti", avatar: "🤖", verified: true, hasPremium: true }, description: "3D characters, cyberpunk loops and high-fidelity textures.", icon: "🤖", subscribers: [] }
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
