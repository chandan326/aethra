const express = require("express");
const router = express.Router();
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
