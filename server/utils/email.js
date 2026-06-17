const nodemailer = require("nodemailer");

async function sendVerificationEmail(toEmail, otp) {
  // Check if SMTP environment variables are defined
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP email credentials are not configured on the server. Please set SMTP_USER and SMTP_PASS in the .env file.");
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Aethra Security" <${smtpUser}>`,
      to: toEmail,
      subject: "Aethra Account Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #0b0c10; color: #c5c6c7;">
          <h2 style="color: #66fcf1; text-align: center; border-bottom: 2px solid #45f3ff; padding-bottom: 12px;">Aethra Account Verification</h2>
          <p>Hello,</p>
          <p>Thank you for signing up on Aethra. To complete your registration and protect your account from unauthorized access, please verify your Gmail address using the following One-Time Password (OTP):</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #45f3ff; background-color: #1f2833; padding: 12px 24px; border-radius: 6px; border: 1px dashed #66fcf1; display: inline-block;">${otp}</span>
          </div>
          <p style="color: #858585; font-size: 14px;">This OTP will expire in 10 minutes. Please do not share this code with anyone. If you did not sign up for an Aethra account, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #1f2833; margin: 20px 0;" />
          <p style="font-size: 12px; color: #5a5a5a; text-align: center;">Aethra Premium Creative Marketplace &copy; 2026</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📨 Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Failed to send verification email via SMTP:", err.message);
    throw err;
  }
}

async function sendResetPasswordEmail(toEmail, otp) {
  // Check if SMTP environment variables are defined
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP email credentials are not configured on the server. Please set SMTP_USER and SMTP_PASS in the .env file.");
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Aethra Security" <${smtpUser}>`,
      to: toEmail,
      subject: "Aethra Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #0b0c10; color: #c5c6c7;">
          <h2 style="color: #ef4444; text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 12px;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password on Aethra. To confirm this request and set a new password, please use the following One-Time Password (OTP):</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ef4444; background-color: #1f2833; padding: 12px 24px; border-radius: 6px; border: 1px dashed #ef4444; display: inline-block;">${otp}</span>
          </div>
          <p style="color: #858585; font-size: 14px;">This OTP will expire in 10 minutes. Please do not share this code with anyone. If you did not request to reset your password, please ignore this email or contact support if you suspect unauthorized access.</p>
          <hr style="border: 0; border-top: 1px solid #1f2833; margin: 20px 0;" />
          <p style="font-size: 12px; color: #5a5a5a; text-align: center;">Aethra Premium Creative Marketplace &copy; 2026</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📨 Reset password email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Failed to send reset password email via SMTP:", err.message);
    throw err;
  }
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
