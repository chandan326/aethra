const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Message = require("../models/Message");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to provide clean mock answers if no key is set
function getMockResponse(text) {
  const query = text.toLowerCase();
  const isHindi = /[\u0900-\u097F]/.test(text) || query.includes("kaise") || query.includes("kya") || query.includes("karo") || query.includes("batao");

  if (isHindi) {
    if (query.includes("grow") || query.includes("बढ़") || query.includes("channel") || query.includes("चैनल")) {
      return "📈 **अपने ऐथ्रा चैनल को बढ़ाने के लिए:**\n1. **नियमित रूप से पोस्ट करें:** जो सप्ताह में 3+ बार पोस्ट करते हैं, वे 4 गुना तेजी से बढ़ते हैं।\n2. **प्रशंसकों से जुड़ें:** अपनी AI कला और स्टिकर पर टिप्पणियों का उत्तर दें।\n3. **प्रचार करें:** अपने सोशल मीडिया पर अपने चैनल का हैंडल साझा करें!\n\nक्या आप एक सामग्री शेड्यूल बनाना चाहते हैं?";
    }
    if (query.includes("hashtag") || query.includes("tag") || query.includes("हैशटैग") || query.includes("टैग")) {
      return "🏷️ **ट्रेंडिंग ऐथ्रा हैशटैग:**\n- `#AIArt` (Midjourney और Stable Diffusion क्रिएटर्स के लिए)\n- `#IndianCreators` (हमारा स्थानीय समुदाय हब)\n- `#StickerPack` (स्टिकर सेट दिखाने के लिए)\n- `#Cyberpunk` और `#Kawaii` (सबसे अधिक खोजे जाने वाले स्टाइल)\n\nअपनी अगली पोस्ट के विवरण में इनमें से 3-4 हैशटैग जोड़ने का प्रयास करें!";
    }
    if (query.includes("monetize") || query.includes("earning") || query.includes("paid") || query.includes("price") || query.includes("कमा") || query.includes("पैसे") || query.includes("मूल्य")) {
      return "💰 **ऐथ्रा पर कमाई (Monetizing):**\n- **सशुल्क लिस्टिंग (Paid Listings):** मार्केटप्लेस में प्रीमियम पैक या उच्च-रिज़ॉल्यूशन वाले आर्ट बंडल सूचीबद्ध करें।\n- **फ़ॉलोअर्स और सब्सक्राइबर्स:** अपनी प्रोफ़ाइल सेटिंग में फ़ॉलोअर/सब्सक्राइबर टियर के पीछे विशेष पोस्ट लॉक करें।\n- **मूल्य निर्धारण टिप:** शुरुआती ग्राहक बनाने के लिए अपना पहला स्टिकर पैक ₹29 - ₹49 पर शुरू करें!";
    }
    if (query.includes("prompt") || query.includes("midjourney") || query.includes("stable") || query.includes("प्रॉम्ट") || query.includes("लिख")) {
      return "✨ **AI प्रॉम्टिंग सीक्रेट:**\nप्रॉम्ट में विवरण शामिल करें जैसे: **[विषय], [शैली], [प्रकाश/मनोदशा], [कैमरा विवरण]**।\n*उदाहरण:* `A cyberpunk tea-stall in Mumbai, rain, cinematic lighting, neon signs, 8k resolution`।\n\nआप किस प्रकार की छवि बनाने का प्रयास कर रहे हैं?";
    }
    return "👋 नमस्ते! मैं ऐथ्रा AI हूँ, आपका रचनात्मक सहायक।\n\nमैं चैनल बनाने, AI आर्ट के लिए प्रॉम्ट बनाने, हैशटैग चुनने या मूल्य निर्धारण में आपकी मदद कर सकता हूँ। आप आज किस प्रोजेक्ट पर काम कर रहे हैं? 😊";
  }

  // English fallbacks
  if (query.includes("grow") || query.includes("audience") || query.includes("channel")) {
    return "📈 **To grow your Aethra Channel:**\n1. **Post regularly:** Creators who post 3+ times a week grow 4x faster.\n2. **Engage with fans:** Reply to comments on your AI art and stickers.\n3. **Promote:** Share your channel handle on your socials!\n\nDo you want to plan a content schedule?";
  }
  if (query.includes("hashtag") || query.includes("tag")) {
    return "🏷️ **Trending Aethra Hashtags:**\n- `#AIArt` (for Midjourney & Stable Diffusion creators)\n- `#IndianCreators` (our local community hub)\n- `#StickerPack` (great for showing off sticker sets)\n- `#Cyberpunk` & `#Kawaii` (highly searched styles)\n\nTry adding 3-4 of these to your next post description!";
  }
  if (query.includes("monetize") || query.includes("earning") || query.includes("paid") || query.includes("price")) {
    return "💰 **Monetizing on Aethra:**\n- **Paid Listings:** List premium packs or high-res art bundles in the Marketplace.\n- **Followers & Subscribers:** Lock exclusive posts behind a follower/subscriber tier in your profile settings.\n- **Pricing Tip:** Start your first sticker pack at ₹29 - ₹49 to build a customer base!";
  }
  if (query.includes("prompt") || query.includes("midjourney") || query.includes("stable")) {
    return "✨ **AI Prompting Secret:**\nInclude details like **[subject], [style], [lighting/mood], [camera/lens details]**.\n*Example:* `A cyberpunk tea-stall in Mumbai, rain, cinematic lighting, neon signs, 8k resolution`.\n\nWhat kind of image are you trying to generate?";
  }
  return "👋 Hello! I'm Aethra AI, your creative assistant.\n\nI can help you build your channel, generate prompts for AI art, choose hashtags, or plan your marketplace pricing. What creative project are you working on today? 😊";
}

// In-memory fallback if MongoDB is not connected
if (!global.mockMessages) {
  global.mockMessages = [];
}

// 1. GET ALL CONVERSATIONS/CHANNELS FOR CURRENT USER
router.get("/conversations", auth, async (req, res) => {
  try {
    const isOnline = mongoose.connection.readyState === 1;
    const userId = req.user.id;
    let userMessages = [];

    if (isOnline) {
      userMessages = await Message.find({
        $or: [
          { sender: userId },
          { recipient: userId }
        ]
      }).sort({ createdAt: -1 });
    } else {
      userMessages = global.mockMessages
        .filter(m => m.sender === userId || m.recipient === userId)
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    const convoMap = new Map();
    for (const msg of userMessages) {
      let otherId = msg.sender.toString() === userId ? msg.recipient : msg.sender.toString();
      if (otherId === "60c72b2f9b1d8a001c8c8c8c") {
        otherId = "aethra";
      }
      if (!convoMap.has(otherId)) {
        convoMap.set(otherId, msg);
      }
    }

    // Pre-fetch all user profiles in one single query to avoid N+1 query overhead
    const otherUserIds = [];
    for (const [otherId] of convoMap.entries()) {
      if (mongoose.Types.ObjectId.isValid(otherId)) {
        otherUserIds.push(otherId);
      }
    }
    const userMap = new Map();
    if (isOnline && otherUserIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: otherUserIds } }).select("displayName username avatar");
        for (const u of users) {
          userMap.set(u._id.toString(), u);
        }
      } catch (dbErr) {
        console.warn("Failed to pre-fetch conversation users:", dbErr.message);
      }
    }

    // Build the conversations list
    const list = [];
    const defaults = ["aethra", "meera", "ravi", "priya"];

    for (const [otherId, lastMsg] of convoMap.entries()) {
      if (otherId === "aethra") {
        list.push({
          id: "aethra",
          name: "Aethra AI",
          subtitle: "Online · Powered by Gemini",
          avatar: "Ae",
          avatarStyle: "background: linear-gradient(135deg, var(--blue), var(--indigo)); color: #fff;",
          lastMessage: lastMsg.content,
          lastMessageTime: lastMsg.createdAt,
          lastMessageSender: lastMsg.sender.toString() === "60c72b2f9b1d8a001c8c8c8c" ? "aethra" : lastMsg.sender.toString()
        });
      } else {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(otherId);
        let name = "Creator";
        let avatar = "CR";
        let avatarStyle = "background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff;";
        let subtitle = "Active now · Creator";

        if (isValidObjectId && isOnline) {
          const u = userMap.get(otherId);
          if (u) {
            name = u.displayName || u.username;
            avatar = name.slice(0, 2).toUpperCase();
          }
        } else {
          // Defaults or mock creators fallback
          if (otherId === "meera") {
            name = "Artist Meera";
            avatar = "ME";
            avatarStyle = "background: #f43f5e; color: #fff;";
            subtitle = "Online · Digital Artist";
          } else if (otherId === "ravi") {
            name = "Ravi Photo";
            avatar = "RV";
            avatarStyle = "background: #10b981; color: #fff;";
            subtitle = "Active 2h ago · Creator";
          } else if (otherId === "priya") {
            name = "Pixel Priya";
            avatar = "PP";
            avatarStyle = "background: #0ea5e9; color: #fff;";
            subtitle = "Online · Photographer";
          }
        }

        list.push({
          id: otherId,
          name,
          subtitle,
          avatar,
          avatarStyle,
          lastMessage: lastMsg.content,
          lastMessageTime: lastMsg.createdAt,
          lastMessageSender: lastMsg.sender.toString()
        });
      }
    }

    // Prepopulate defaults if they don't have any messages yet
    defaults.forEach(defId => {
      if (!convoMap.has(defId)) {
        let name = "Aethra AI";
        let avatar = "Ae";
        let avatarStyle = "background: linear-gradient(135deg, var(--blue), var(--indigo)); color: #fff;";
        let subtitle = "Online · Powered by Gemini";
        let initialMessage = "Hello! Let me know if you need help creating content.";

        if (defId === "meera") {
          name = "Artist Meera";
          avatar = "ME";
          avatarStyle = "background: #f43f5e; color: #fff;";
          subtitle = "Online · Digital Artist";
          initialMessage = "Hello! 🎨 Meera here. Welcome to my creative studio!";
        } else if (defId === "ravi") {
          name = "Ravi Photo";
          avatar = "RV";
          avatarStyle = "background: #10b981; color: #fff;";
          subtitle = "Active 2h ago · Creator";
          initialMessage = "Hey! 📸 Got questions about my digital downloads or camera setup?";
        } else if (defId === "priya") {
          name = "Pixel Priya";
          avatar = "PP";
          avatarStyle = "background: #0ea5e9; color: #fff;";
          subtitle = "Online · Photographer";
          initialMessage = "Hello! 📸 Priya here. Welcome to my creative photography studio!";
        }

        list.push({
          id: defId,
          name,
          subtitle,
          avatar,
          avatarStyle,
          lastMessage: initialMessage,
          lastMessageTime: new Date(Date.now() - 3600000), // 1 hour ago placeholder
          lastMessageSender: defId
        });
      }
    });

    // Sort list by last message time descending
    list.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(list);
  } catch (err) {
    console.error("Fetch conversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// 2. GET MESSAGES FOR A SINGLE CHAT PARTNER
router.get("/messages", auth, async (req, res) => {
  try {
    const isOnline = mongoose.connection.readyState === 1;
    const userId = req.user.id;
    const chatWith = req.query.chatWith;

    if (!chatWith) {
      return res.status(400).json({ message: "chatWith parameter is required" });
    }

    let messages = [];
    if (isOnline) {
      const targetChatWith = chatWith === "aethra" ? "60c72b2f9b1d8a001c8c8c8c" : chatWith;
      messages = await Message.find({
        $or: [
          { sender: userId, recipient: targetChatWith },
          { sender: targetChatWith, recipient: userId }
        ]
      }).sort({ createdAt: 1 });

      // Map static AI ID back to "aethra" for frontend matching
      messages = messages.map(m => {
        const msgObj = m.toObject();
        if (msgObj.sender && msgObj.sender.toString() === "60c72b2f9b1d8a001c8c8c8c") {
          msgObj.sender = "aethra";
        }
        return msgObj;
      });
    } else {
      messages = global.mockMessages
        .filter(m => (m.sender === userId && m.recipient === chatWith) || (m.sender === chatWith && m.recipient === userId))
        .sort((a, b) => a.createdAt - b.createdAt);
    }

    res.json(messages);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch message history" });
  }
});

// 3. SEND A MESSAGE (WITH AI AUTOREPLY INTEGRATION IF TARGET IS 'AETHRA')
router.post("/messages", auth, async (req, res) => {
  try {
    const isOnline = mongoose.connection.readyState === 1;
    const userId = req.user.id;
    const { recipientId, content } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({ message: "recipientId and content are required" });
    }

    let savedUserMsg;
    if (isOnline) {
      const msg = new Message({
        sender: userId,
        recipient: recipientId,
        content
      });
      savedUserMsg = await msg.save();
    } else {
      savedUserMsg = {
        _id: new mongoose.Types.ObjectId().toString(),
        sender: userId,
        recipient: recipientId,
        content,
        createdAt: new Date()
      };
      global.mockMessages.push(savedUserMsg);
    }

    let savedBotMsg = null;

    // Trigger AI response if the chat partner is Aethra AI
    if (recipientId === "aethra") {
      let replyText = "";
      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `You are Aethra AI, a smart creative assistant for Aethra (monetize AI art, stickers, wallpapers). Help the user. Keep it under 200 words. Respond in Hindi if the user writes in Hindi.`
          });
          const chat = model.startChat({ history: [] });
          const result = await chat.sendMessage(content);
          const response = await result.response;
          replyText = response.text();
        } catch (apiErr) {
          console.error("Gemini API error in chat route:", apiErr.message);
          replyText = getMockResponse(content);
        }
      } else {
        replyText = getMockResponse(content);
      }

      if (isOnline) {
        const botMsg = new Message({
          sender: new mongoose.Types.ObjectId("60c72b2f9b1d8a001c8c8c8c"), // static model ID placeholder
          recipient: userId,
          content: replyText
        });
        await botMsg.save();
        
        savedBotMsg = botMsg.toObject();
        savedBotMsg.sender = "aethra"; 
      } else {
        savedBotMsg = {
          _id: new mongoose.Types.ObjectId().toString(),
          sender: "aethra",
          recipient: userId,
          content: replyText,
          createdAt: new Date()
        };
        global.mockMessages.push(savedBotMsg);
      }
    }

    res.json({
      success: true,
      message: savedUserMsg,
      reply: savedBotMsg
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;
