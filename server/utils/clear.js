require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Channel = require("../models/Channel");
const SupportTicket = require("../models/SupportTicket");

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/aethra";

async function clearDatabase() {
  try {
    const safeUri = mongoURI.replace(/:([^@]+)@/, ":*****@");
    console.log(`Connecting to MongoDB at: ${safeUri}`);
    await mongoose.connect(mongoURI);
    console.log("✅ Connected! Clearing all database collections...");

    const userDel = await User.deleteMany({});
    const postDel = await Post.deleteMany({});
    const chanDel = await Channel.deleteMany({});
    const suppDel = await SupportTicket.deleteMany({});

    console.log(`🗑️ Database successfully cleared!`);
    console.log(`- Deleted ${userDel.deletedCount} Users`);
    console.log(`- Deleted ${postDel.deletedCount} Posts`);
    console.log(`- Deleted ${chanDel.deletedCount} Channels`);
    console.log(`- Deleted ${suppDel.deletedCount} Support Tickets`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing database:", error.message || error);
    process.exit(1);
  }
}

clearDatabase();
