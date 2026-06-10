const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
  process.env.CLOUDINARY_API_KEY !== "your_api_key" &&
  process.env.CLOUDINARY_API_SECRET !== "your_api_secret"
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
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
