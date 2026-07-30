const path = require("path");
// Ensure dotenv is loaded regardless of execution context
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const nodemailer = require("nodemailer");

function getCredentials() {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP email credentials are not configured on the server. Please set SMTP_USER and SMTP_PASS in your .env file.");
  }
  return { smtpUser, smtpPass };
}

// Create primary SSL transporter (Port 465)
function createPrimaryTransporter(smtpUser, smtpPass) {
  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Create fallback STARTTLS transporter (Port 587)
function createFallbackTransporter(smtpUser, smtpPass) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: "SSLv3"
    }
  });
}

async function sendMailWithRetry(mailOptions, maxRetries = 3) {
  const { smtpUser, smtpPass } = getCredentials();
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Primary 465 on attempts 1 & 2, Fallback 587 on attempt 3
      const transporter = (attempt < maxRetries) 
        ? createPrimaryTransporter(smtpUser, smtpPass) 
        : createFallbackTransporter(smtpUser, smtpPass);

      const info = await transporter.sendMail(mailOptions);
      console.log(`📨 Email delivered successfully on attempt ${attempt}:`, info.messageId);
      return { success: true, messageId: info.messageId, attempt };
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ SMTP send attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        // Wait 1 second before retrying
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }
  }

  console.error("❌ All SMTP delivery attempts failed:", lastErr ? lastErr.message : "Unknown error");
  throw lastErr;
}

async function sendVerificationEmail(toEmail, otp) {
  const { smtpUser } = getCredentials();
  const cleanTo = (toEmail || "").trim();

  const mailOptions = {
    from: `"Aethra Security" <${smtpUser}>`,
    to: cleanTo,
    replyTo: smtpUser,
    subject: "Aethra Account Verification OTP",
    text: `Hello,\n\nThank you for signing up on Aethra. Your verification code is: ${otp}\n\nThis OTP will expire in 10 minutes. Please do not share this code with anyone.\n\n- Aethra Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #1f2937; border-radius: 12px; background: #0b0c10; color: #c5c6c7;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #66fcf1; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">Aethra Verification</h2>
          <p style="color: #9ca3af; font-size: 14px; margin: 0;">Protecting your digital assets</p>
        </div>
        <div style="border-top: 2px solid #45f3ff; margin-bottom: 20px;"></div>
        <p style="font-size: 15px; color: #e5e7eb;">Hello,</p>
        <p style="font-size: 15px; color: #9ca3af; line-height: 1.6;">Thank you for registering on <strong>Aethra</strong>. Please verify your Gmail address using the following 6-digit One-Time Password (OTP):</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #45f3ff; background: #1f2833; padding: 16px 28px; border-radius: 8px; border: 1.5px dashed #66fcf1; display: inline-block; font-family: monospace;">${otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">This code expires in <strong>10 minutes</strong>. If you did not request this verification, please ignore this message.</p>
        <hr style="border: 0; border-top: 1px solid #1f2833; margin: 24px 0;" />
        <p style="font-size: 12px; color: #4b5563; text-align: center; margin: 0;">Aethra Premium Creative Marketplace &copy; 2026</p>
      </div>
    `,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high"
    }
  };

  return await sendMailWithRetry(mailOptions);
}

async function sendResetPasswordEmail(toEmail, otp) {
  const { smtpUser } = getCredentials();
  const cleanTo = (toEmail || "").trim();

  const mailOptions = {
    from: `"Aethra Security" <${smtpUser}>`,
    to: cleanTo,
    replyTo: smtpUser,
    subject: "Aethra Password Reset OTP",
    text: `Hello,\n\nWe received a request to reset your password on Aethra. Your reset code is: ${otp}\n\nThis OTP will expire in 10 minutes. Please do not share this code with anyone.\n\n- Aethra Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #1f2937; border-radius: 12px; background: #0b0c10; color: #c5c6c7;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ef4444; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">Reset Your Password</h2>
          <p style="color: #9ca3af; font-size: 14px; margin: 0;">Aethra Account Security</p>
        </div>
        <div style="border-top: 2px solid #ef4444; margin-bottom: 20px;"></div>
        <p style="font-size: 15px; color: #e5e7eb;">Hello,</p>
        <p style="font-size: 15px; color: #9ca3af; line-height: 1.6;">We received a request to reset your password on Aethra. Please use the following 6-digit One-Time Password (OTP) to set your new password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef4444; background: #1f2833; padding: 16px 28px; border-radius: 8px; border: 1.5px dashed #ef4444; display: inline-block; font-family: monospace;">${otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">This code expires in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this message or contact support.</p>
        <hr style="border: 0; border-top: 1px solid #1f2833; margin: 24px 0;" />
        <p style="font-size: 12px; color: #4b5563; text-align: center; margin: 0;">Aethra Premium Creative Marketplace &copy; 2026</p>
      </div>
    `,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high"
    }
  };

  return await sendMailWithRetry(mailOptions);
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
