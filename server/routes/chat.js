const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to provide clean mock answers if no key is set
function getMockResponse(text) {
  const query = text.toLowerCase();
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

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ message: "Messages history is required" });
    }

    const lastMessage = messages[messages.length - 1].content;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Return realistic mock response if no API key is configured
      const reply = getMockResponse(lastMessage);
      return res.json({ reply });
    }

    const systemInstruction = `You are Aethra AI, a smart and friendly creative assistant for Aethra — India's top creative platform where users share AI-generated images, GIFs, stickers, and digital art. Help creators with content strategy, AI tool recommendations, hashtag ideas, monetization, prompt engineering, and platform features.
    
    Platform features:
    - AI image sharing (Midjourney, DALL·E, Stable Diffusion)
    - GIF creation & sharing  
    - Sticker pack creation and sales
    - Creative channels & subscriber tiers
    - Public / Private / Followers-only visibility
    - Free & Paid content with ₹ pricing
    - Marketplace for selling art
    
    Tone: Enthusiastic, concise, helpful. Use emojis naturally. Give actionable specific advice. If the user writes in Hindi, respond in Hindi. Keep responses under 200 words. Use markdown for clarity.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction
    });

    // Format history for Gemini
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    
    res.json({ reply: response.text() });
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    res.status(500).json({ message: "Failed to communicate with AI model. Falling back to platform offline assistant." });
  }
});

module.exports = router;
