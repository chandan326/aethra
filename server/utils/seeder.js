const User = require("../models/User");
const Post = require("../models/Post");
const Channel = require("../models/Channel");
const bcrypt = require("bcryptjs");

async function seedDatabase() {
  try {
    if (process.env.SEED_DATABASE !== "true") {
      console.log("Database seeding skipped (SEED_DATABASE env var is not 'true').");
      return;
    }
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log("Database already seeded. Skipping seeder.");
      return;
    }

    console.log("🌱 Seeding database with initial mock data...");

    // Create a default password hash
    const defaultPassword = await bcrypt.hash("Test12345", 10);

    // Mock Users
    const mockUsers = [
      { username: "artby_meera", email: "meera@aethra.com", displayName: "Meera Art", avatar: "🎨", bio: "AI Artist & designer.", verified: true, upiId: "meera@okaxis", hasPremium: true, subscriptionPlan: "1 Year Elite VIP" },
      { username: "space_vfx", email: "space@aethra.com", displayName: "SpaceVFX", avatar: "🌌", bio: "GIF Creator & animator.", verified: true, upiId: "space@okaxis", hasPremium: true, subscriptionPlan: "6 Months Creator Plus" },
      { username: "catlife", email: "cat@aethra.com", displayName: "Cat Life", avatar: "😺", bio: "Sticker Designer.", verified: true, upiId: "catlife@okaxis" },
      { username: "cyberpunk_dev", email: "cyber@aethra.com", displayName: "Neon Dev", avatar: "⚡", bio: "Cyberpunk artist.", verified: true, upiId: "cyberpunk@okaxis" },
      { username: "mythcraft_rohit", email: "rohit@aethra.com", displayName: "MythCraft", avatar: "🐉", bio: "Fantasy Art.", verified: true, upiId: "mythcraft@okaxis" },
      { username: "pixel_priya", email: "priya@aethra.com", displayName: "Pixel Priya", avatar: "🌸", bio: "Kawaii Creator.", verified: true, upiId: "priya@okaxis" },
      { username: "lens_lens", email: "lens@aethra.com", displayName: "Lens & Shutter", avatar: "📸", bio: "Landscape & street photography.", verified: true, upiId: "lens@okaxis" },
      { username: "synth_3d", email: "avanti@aethra.com", displayName: "AI Avanti", avatar: "🤖", bio: "Illustrator and 3D visual artist.", verified: true, upiId: "avanti@okaxis", hasPremium: true, subscriptionPlan: "2 Months Boost" }
    ];

    const users = [];
    for (const u of mockUsers) {
      const newUser = new User({ ...u, password: defaultPassword });
      await newUser.save();
      users.push(newUser);
    }

    // Mock Channels
    const mockChannels = [
      { name: "ArtHive Studio", handle: "artby_meera", owner: users[0]._id, description: "Weekly AI art drops, tutorials & behind the scenes of digital creation.", icon: "🎨" },
      { name: "Cosmic Creations", handle: "space_vfx", owner: users[1]._id, description: "Space, sci-fi & surreal AI art. New posts every Tuesday & Friday.", icon: "🌌" },
      { name: "Dragon Forge", handle: "mythcraft_rohit", owner: users[4]._id, description: "Fantasy creatures, mythological AI art & epic GIF animations.", icon: "🐉" },
      { name: "Kawaii World", handle: "pixel_priya", owner: users[5]._id, description: "Cute stickers, anime-inspired AI art and aesthetic GIF collections.", icon: "🌸" },
      { name: "Neon District", handle: "cyberpunk_dev", owner: users[3]._id, description: "Cyberpunk art, neon aesthetics & futuristic digital visuals.", icon: "⚡" },
      { name: "Aperture Club", handle: "lens_lens", owner: users[6]._id, description: "Breathtaking photography, camera presets, and guides.", icon: "📸" },
      { name: "Sticker Paradise", handle: "catlife", owner: users[2]._id, description: "Sticker sets, vector assets and fun graphics.", icon: "😺" },
      { name: "Synth Wave 3D", handle: "synth_3d", owner: users[7]._id, description: "3D characters, cyberpunk loops and high-fidelity textures.", icon: "🤖" }
    ];

    for (const c of mockChannels) {
      const channel = new Channel(c);
      await channel.save();
    }

    // Mock Posts (using emojis as Content placeholders)
    const mockPosts = [
      { title: "Cosmic Dreamscape", content: "🌌", contentType: "AI", pricing: "paid", price: 99, creator: users[0]._id },
      { title: "Neon Dragon", content: "🐉", contentType: "AI", pricing: "free", creator: users[4]._id },
      { title: "Sakura Rain", content: "🌸", contentType: "AI", pricing: "free", creator: users[5]._id },
      { title: "Cyber Samurai", content: "🤖", contentType: "AI", pricing: "paid", price: 149, creator: users[3]._id },
      { title: "Galaxy Spin", content: "💫", contentType: "GIF", pricing: "free", creator: users[1]._id },
      { title: "Fire Dance", content: "🔥", contentType: "GIF", pricing: "free", creator: users[0]._id },
      { title: "Cool Cat Pack", content: "😎", contentType: "STICKER", pricing: "free", creator: users[2]._id },
      { title: "Love Hearts", content: "🥰", contentType: "STICKER", pricing: "free", creator: users[2]._id },
      { title: "Midnight Vibes", content: "🌙", contentType: "STICKER", pricing: "paid", price: 29, creator: users[0]._id }
    ];

    for (const p of mockPosts) {
      const post = new Post(p);
      await post.save();
    }

    console.log("✅ Seeded database successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error.message || error);
  }
}

module.exports = seedDatabase;
