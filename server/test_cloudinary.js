require("dotenv").config();
const { uploadToCloudinary, isConfigured } = require("./utils/cloudinary");
const fs = require("fs");
const path = require("path");

console.log("Is Configured:", isConfigured);
console.log("CLOUDINARY_URL:", process.env.CLOUDINARY_URL);
console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "Exists (Length: " + process.env.CLOUDINARY_API_SECRET.length + ")" : "Missing");

// Create a small test file
const testFilePath = path.join(__dirname, "test_file_temp.txt");
fs.writeFileSync(testFilePath, "Hello Cloudinary! Testing upload.");

async function run() {
  console.log("Uploading test file to Cloudinary...");
  const result = await uploadToCloudinary(testFilePath, "aethra_test_uploads");
  console.log("Upload Result:", result);
  
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
}

run();
