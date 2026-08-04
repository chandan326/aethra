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

async function sendSupportTicketNotification({ ticketId, name, email, category, subject, message }) {
  const { smtpUser } = getCredentials();
  const supportEmail = (process.env.TECHNICAL_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "can.yamn0020@gmail.com").trim();
  const cleanUserEmail = (email || "").trim();
  const cleanName = (name || "User").trim();
  const cleanSubject = (subject || "No Subject").trim();
  const rawCategory = (category || "technical").toLowerCase();
  
  let categoryLabel = "💻 Technical Support";
  let categoryColor = "#3b82f6";
  let categoryBg = "rgba(59, 130, 246, 0.15)";

  if (rawCategory.includes("billing") || rawCategory.includes("payment")) {
    categoryLabel = "💰 Billing & Monetization";
    categoryColor = "#10b981";
    categoryBg = "rgba(16, 185, 129, 0.15)";
  } else if (rawCategory.includes("account") || rawCategory.includes("security")) {
    categoryLabel = "🔒 Account & Security";
    categoryColor = "#f59e0b";
    categoryBg = "rgba(245, 158, 11, 0.15)";
  } else if (rawCategory.includes("feedback") || rawCategory.includes("suggestion")) {
    categoryLabel = "✨ Feedback & Suggestions";
    categoryColor = "#8b5cf6";
    categoryBg = "rgba(139, 92, 246, 0.15)";
  }

  const cleanMessage = (message || "").trim();
  const safeMessage = cleanMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const formattedDate = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium"
  });

  const mailOptions = {
    from: `"Aethra Support Platform" <${smtpUser}>`,
    to: supportEmail,
    replyTo: `"${cleanName}" <${cleanUserEmail}>`,
    subject: `🚨 [SUPPORT COMPLAINT] Ticket #${ticketId}: ${cleanSubject}`,
    text: `=== AETHRA NEW SUPPORT COMPLAINT ===\n\nTicket ID: #${ticketId}\nFrom: ${cleanName} (${cleanUserEmail})\nCategory: ${categoryLabel}\nSubject: ${cleanSubject}\nDate: ${formattedDate}\n\nComplaint Message:\n----------------------------------------\n${cleanMessage}\n----------------------------------------\n\nTo reply, hit Reply in your email client to contact ${cleanUserEmail} directly.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Support Ticket / Complaint</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                
                <!-- Top Brand Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px 32px; border-bottom: 1px solid #374151; text-align: left;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: linear-gradient(135deg, #0284c7, #3b82f6); color: #ffffff; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px; font-family: monospace; letter-spacing: 1px;">AETHRA</span>
                          <span style="color: #94a3b8; font-size: 13px; margin-left: 10px; font-weight: 500;">SUPPORT TICKETING SYSTEM</span>
                        </td>
                        <td align="right">
                          <span style="display: inline-block; background: #ef444420; color: #f87171; border: 1px solid #ef444440; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">🚨 Action Needed</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px;">
                    
                    <h1 style="margin: 0 0 8px 0; color: #f8fafc; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                      New Customer Complaint Received
                    </h1>
                    <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
                      A user has raised a support ticket on the Aethra platform. Details and complaint description are provided below.
                    </p>

                    <!-- Ticket Metadata Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b50; border: 1px solid #334155; border-radius: 12px; margin-bottom: 24px; border-collapse: separate;">
                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Ticket ID</td>
                              <td style="color: #38bdf8; font-family: monospace; font-size: 16px; font-weight: 800;">#${ticketId}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Category</td>
                              <td>
                                <span style="display: inline-block; background-color: ${categoryBg}; color: ${categoryColor}; border: 1px solid ${categoryColor}40; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">
                                  ${categoryLabel}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Complainant</td>
                              <td style="color: #f1f5f9; font-size: 14px; font-weight: 600;">
                                ${cleanName}
                                <span style="color: #38bdf8; font-weight: 400; font-size: 13px; margin-left: 6px;">(&lt;${cleanUserEmail}&gt;)</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #334155;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Subject</td>
                              <td style="color: #ffffff; font-size: 14px; font-weight: 700;">${cleanSubject}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 16px 20px;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Timestamp</td>
                              <td style="color: #94a3b8; font-size: 13px; font-weight: 500;">${formattedDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Complaint Text Container -->
                    <div style="margin-bottom: 28px;">
                      <div style="color: #cbd5e1; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                        📄 Message / Description:
                      </div>
                      <div style="background-color: #0f172a; border-left: 4px solid #38bdf8; border-radius: 8px; padding: 20px; color: #f8fafc; font-size: 14px; line-height: 1.7; white-space: pre-wrap; font-family: 'Segoe UI', sans-serif;">
${safeMessage}
                      </div>
                    </div>

                    <!-- Direct Reply Call to Action -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #0369a120, #1d4ed820); border: 1px solid #0284c740; border-radius: 12px; padding: 18px 20px; text-align: center; margin-bottom: 12px;">
                      <tr>
                        <td>
                          <div style="color: #38bdf8; font-size: 14px; font-weight: 700; margin-bottom: 4px;">
                            ✉️ Direct Reply Enabled
                          </div>
                          <div style="color: #94a3b8; font-size: 13px;">
                            Simply click <strong>"Reply"</strong> in your Gmail / Email client to send your response directly to <strong>${cleanName}</strong> (${cleanUserEmail}).
                          </div>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #0f172a; padding: 20px 32px; border-top: 1px solid #1f2937; text-align: center;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 500;">
                      Aethra Marketplace Technical Support &bull; Automated Dispatch
                    </p>
                    <p style="margin: 0; color: #475569; font-size: 11px;">
                      Confidential &bull; Sent to Technical Support Lead (${supportEmail})
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high"
    }
  };

  return await sendMailWithRetry(mailOptions);
}

async function sendSupportUserConfirmation({ ticketId, name, email, category, subject, message }) {
  const { smtpUser } = getCredentials();
  const cleanUserEmail = (email || "").trim();
  const cleanName = (name || "Valued User").trim();
  const cleanSubject = (subject || "Support Query").trim();

  const safeMessage = (message || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const formattedDate = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium"
  });

  const mailOptions = {
    from: `"Aethra Customer Support" <${smtpUser}>`,
    to: cleanUserEmail,
    replyTo: "can.yamn0020@gmail.com",
    subject: `[Support Ticket #${ticketId}] We've received your request: ${cleanSubject}`,
    text: `Hello ${cleanName},\n\nThank you for contacting Aethra Support.\n\nYour support ticket #${ticketId} has been successfully registered and assigned to our Technical Support team.\n\nTicket Summary:\n- Ticket ID: #${ticketId}\n- Subject: ${cleanSubject}\n- Date: ${formattedDate}\n\nMessage:\n${message}\n\nOur dedicated support team reviews all tickets within 24 hours. You will receive direct updates at this email address.\n\nBest regards,\nAethra Technical Support Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Ticket Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                
                <!-- Top Brand Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 24px 32px; border-bottom: 1px solid #374151; text-align: left;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: linear-gradient(135deg, #0284c7, #3b82f6); color: #ffffff; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px; font-family: monospace; letter-spacing: 1px;">AETHRA</span>
                          <span style="color: #94a3b8; font-size: 13px; margin-left: 10px; font-weight: 500;">HELP & SUPPORT</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px;">
                    <div style="display: inline-block; background-color: #10b98120; color: #34d399; border: 1px solid #10b98140; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px;">
                      ✅ Ticket Created Successfully
                    </div>

                    <h2 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 20px; font-weight: 800;">
                      Hello ${cleanName},
                    </h2>
                    <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                      Thank you for reaching out to Aethra Help & Support. We have logged your request under Ticket ID <strong style="color: #38bdf8; font-family: monospace;">#${ticketId}</strong> and assigned it to our Technical Support team.
                    </p>

                    <!-- Summary Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b50; border: 1px solid #334155; border-radius: 10px; margin-bottom: 24px; border-collapse: separate;">
                      <tr>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #334155; color: #64748b; font-size: 13px; font-weight: 600; width: 100px;">Subject</td>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #334155; color: #f1f5f9; font-size: 14px; font-weight: 700;">${cleanSubject}</td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 18px; color: #64748b; font-size: 13px; font-weight: 600;">Message</td>
                        <td style="padding: 14px 18px; color: #cbd5e1; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${safeMessage}</td>
                      </tr>
                    </table>

                    <div style="background-color: #0f172a; border-left: 4px solid #38bdf8; border-radius: 6px; padding: 16px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                      ⏱️ <strong>Response Time:</strong> Our technical team reviews all submissions within <strong>24 hours</strong>. When a technician replies to your ticket, you will receive an email directly to this address.
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #0f172a; padding: 20px 32px; border-top: 1px solid #1f2937; text-align: center;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px;">
                      Aethra Marketplace Support Team &bull; Official Confirmation
                    </p>
                    <p style="margin: 0; color: #475569; font-size: 11px;">
                      Need urgent help? Contact us at <a href="mailto:can.yamn0020@gmail.com" style="color: #38bdf8; text-decoration: none;">can.yamn0020@gmail.com</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  return await sendMailWithRetry(mailOptions);
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail, sendSupportTicketNotification, sendSupportUserConfirmation };
