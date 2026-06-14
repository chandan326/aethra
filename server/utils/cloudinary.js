const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const finalUrl = process.env.CLOUDINARY_URL || "cloudinary://434572755227279:IqJXROIpkbFsqR2CVSLVPOAJZVY@dky63jssw";
const finalCloudName = process.env.CLOUDINARY_CLOUD_NAME || "dky63jssw";
const finalApiKey = process.env.CLOUDINARY_API_KEY || "434572755227279";
const finalApiSecret = process.env.CLOUDINARY_API_SECRET || "IqJXROIpkbFsqR2CVSLVPOAJZVY";

const hasUrl = !!(
  finalUrl &&
  finalUrl.startsWith("cloudinary://") &&
  !finalUrl.includes("**********") &&
  !finalUrl.includes("your_")
);

const hasKeys = !!(
  finalCloudName &&
  finalApiKey &&
  finalApiSecret &&
  finalCloudName !== "your_cloud_name" &&
  finalApiKey !== "your_api_key" &&
  finalApiSecret !== "your_api_secret"
);

const isConfigured = hasUrl || hasKeys;

if (isConfigured) {
  cloudinary.config({
    cloud_name: finalCloudName,
    api_key: finalApiKey,
    api_secret: finalApiSecret
  });
  console.log("☁️ Cloudinary storage configured successfully.");
} else {
  console.warn("⚠️ Cloudinary credentials missing. Operating in local fallback mode.");
}

/**
 * Uploads a local file to Cloudinary and deletes the local temporary file.
 * @param {string} filePath - Path to the local file.
 * @param {string} folder - Destination folder in Cloudinary (e.g., 'aethra_posts').
 * @returns {Promise<{success: boolean, url?: string}>}
 */
async function uploadToCloudinary(filePath, folder) {
  if (!isConfigured) {
    return { success: false };
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: "auto"
    });

    // Delete local file after successful upload
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting temp file after Cloudinary upload:", err);
    });

    return { success: true, url: result.secure_url };
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return { success: false };
  }
}

module.exports = {
  cloudinary,
  isConfigured,
  uploadToCloudinary
};
