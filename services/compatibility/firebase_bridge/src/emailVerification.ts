import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

// Enable CORS for all origins in development
const cors = require("cors")({ origin: true });

const log = {
  info: (msg: string) => console.log(`ℹ️ [EmailVerification] ${msg}`),
  success: (msg: string) => console.log(`✅ [EmailVerification] ${msg}`),
  error: (msg: string) => console.error(`❌ [EmailVerification] ${msg}`)
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getWelcomeEmailHTML(userName: string, otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      background: #f5f7fa; 
      padding: 20px;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
    }
    .header { 
      background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR} 0%, #0a3d41 100%); 
      padding: 40px 30px; 
      text-align: center; 
    }
    .logo { 
      width: 80px; 
      height: 80px; 
      margin-bottom: 16px; 
      border-radius: 16px;
    }
    .header h1 { 
      color: white; 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 8px; 
    }
    .header p { 
      color: rgba(255,255,255,0.9); 
      font-size: 16px; 
    }
    .content { 
      padding: 40px 30px; 
    }
    .greeting { 
      color: #1a202c; 
      font-size: 22px; 
      font-weight: 600; 
      margin-bottom: 16px; 
    }
    .text { 
      color: #4a5568; 
      font-size: 16px; 
      line-height: 1.6; 
      margin-bottom: 24px; 
    }
    .otp-box { 
      background: linear-gradient(135deg, rgba(15, 82, 87, 0.08) 0%, rgba(10, 61, 65, 0.12) 100%); 
      border: 2px dashed ${EMAIL_CONFIG.BRAND_COLOR}; 
      border-radius: 12px; 
      padding: 32px; 
      text-align: center; 
      margin: 30px 0; 
    }
    .otp-label { 
      font-size: 14px; 
      color: #718096; 
      margin-bottom: 12px; 
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .otp-code { 
      font-size: 42px; 
      font-weight: 700; 
      color: ${EMAIL_CONFIG.BRAND_COLOR}; 
      letter-spacing: 12px; 
      font-family: 'Courier New', monospace; 
      user-select: all;
    }
    .otp-validity { 
      font-size: 13px; 
      color: #e53e3e; 
      margin-top: 16px; 
      font-weight: 600;
    }
    .security-note { 
      background: #fef5e7; 
      border-left: 4px solid #f39c12; 
      padding: 16px 20px; 
      border-radius: 8px; 
      margin: 24px 0; 
    }
    .security-note p { 
      color: #856404; 
      margin: 0; 
      font-size: 14px; 
      line-height: 1.5;
    }
    .divider { 
      height: 1px; 
      background: #e2e8f0; 
      margin: 30px 0; 
    }
    .footer { 
      background: #f7fafc; 
      padding: 30px; 
      text-align: center; 
      color: #718096; 
      font-size: 14px; 
      line-height: 1.6;
    }
    .footer a { 
      color: ${EMAIL_CONFIG.BRAND_COLOR}; 
      text-decoration: none; 
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${EMAIL_CONFIG.LOGO_URL}" alt="${EMAIL_CONFIG.APP_NAME}" class="logo">
      <h1>Welcome to ${EMAIL_CONFIG.APP_NAME}! 🎉</h1>
      <p>Verify your email to get started</p>
    </div>
    <div class="content">
      <div class="greeting">Hi ${userName},</div>
      <p class="text">
        Thank you for joining <strong>${EMAIL_CONFIG.APP_NAME}</strong>! We're excited to have you on board. 
        To complete your registration and ensure the security of your account, please verify your email address.
      </p>
      <div class="otp-box">
        <div class="otp-label">Your Verification Code</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-validity">⏱️ Valid for 10 minutes</div>
      </div>
      <p class="text">Enter this code in the app to verify your email and unlock all features.</p>
      <div class="security-note">
        <p><strong>Security Reminder:</strong> Never share this code with anyone.</p>
      </div>
    </div>
    <div class="footer">
      <p><strong>${EMAIL_CONFIG.APP_NAME}</strong><br>
      Your trusted marketplace for everything</p>
      <p style="font-size: 12px; color: #a0aec0; margin-top: 16px;">
        © ${new Date().getFullYear()} ${EMAIL_CONFIG.APP_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getSellerVerificationEmailHTML(userName: string, verificationLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      background: #f5f7fa; 
      padding: 20px;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
    }
    .header { 
      background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR} 0%, #0a3d41 100%); 
      padding: 40px 30px; 
      text-align: center; 
    }
    .logo { 
      width: 80px; 
      height: 80px; 
      margin-bottom: 16px; 
      border-radius: 16px;
    }
    .header h1 { 
      color: white; 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 8px; 
    }
    .header p { 
      color: rgba(255,255,255,0.9); 
      font-size: 16px; 
    }
    .content { 
      padding: 40px 30px; 
    }
    .greeting { 
      color: #1a202c; 
      font-size: 22px; 
      font-weight: 600; 
      margin-bottom: 16px; 
    }
    .text { 
      color: #4a5568; 
      font-size: 16px; 
      line-height: 1.6; 
      margin-bottom: 24px; 
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .verify-btn { 
      display: inline-block;
      background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR} 0%, #0a3d41 100%);
      color: white !important; 
      padding: 18px 48px; 
      font-size: 18px; 
      font-weight: 700; 
      text-decoration: none; 
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(15, 82, 87, 0.3);
    }
    .link-fallback {
      background: #f7fafc;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      word-break: break-all;
    }
    .link-fallback p {
      color: #718096;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .link-fallback a {
      color: ${EMAIL_CONFIG.BRAND_COLOR};
      font-size: 12px;
    }
    .validity { 
      text-align: center;
      font-size: 14px; 
      color: #e53e3e; 
      margin-top: 16px; 
      font-weight: 600;
    }
    .features {
      background: linear-gradient(135deg, rgba(15, 82, 87, 0.05) 0%, rgba(10, 61, 65, 0.08) 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .features h3 {
      color: ${EMAIL_CONFIG.BRAND_COLOR};
      font-size: 16px;
      margin-bottom: 16px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      color: #4a5568;
      font-size: 14px;
    }
    .feature-icon {
      margin-right: 12px;
      font-size: 18px;
    }
    .security-note { 
      background: #fef5e7; 
      border-left: 4px solid #f39c12; 
      padding: 16px 20px; 
      border-radius: 8px; 
      margin: 24px 0; 
    }
    .security-note p { 
      color: #856404; 
      margin: 0; 
      font-size: 14px; 
      line-height: 1.5;
    }
    .footer { 
      background: #f7fafc; 
      padding: 30px; 
      text-align: center; 
      color: #718096; 
      font-size: 14px; 
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${EMAIL_CONFIG.LOGO_URL}" alt="${EMAIL_CONFIG.APP_NAME}" class="logo">
      <h1>Welcome to ${EMAIL_CONFIG.APP_NAME} Seller! 🏪</h1>
      <p>Start your selling journey today</p>
    </div>
    <div class="content">
      <div class="greeting">Hi ${userName},</div>
      <p class="text">
        Congratulations on registering as a seller on <strong>${EMAIL_CONFIG.APP_NAME}</strong>! 
        You're just one step away from starting your selling journey. Click the button below to verify your email address.
      </p>
      
      <div class="btn-container">
        <a href="${verificationLink}" class="verify-btn">✓ Verify My Email</a>
      </div>
      
      <p class="validity">⏱️ This link expires in 24 hours</p>
      
      <div class="link-fallback">
        <p>If the button doesn't work, copy and paste this link in your browser:</p>
        <a href="${verificationLink}">${verificationLink}</a>
      </div>

      <div class="features">
        <h3>🚀 What's Next After Verification?</h3>
        <div class="feature-item"><span class="feature-icon">📋</span> Complete your KYC verification</div>
        <div class="feature-item"><span class="feature-icon">🏦</span> Add your bank details for payouts</div>
        <div class="feature-item"><span class="feature-icon">📦</span> List your first product</div>
        <div class="feature-item"><span class="feature-icon">💰</span> Start receiving orders!</div>
      </div>

      <div class="security-note">
        <p><strong>Security Reminder:</strong> If you didn't create this account, please ignore this email or contact our support.</p>
      </div>
    </div>
    <div class="footer">
      <p><strong>${EMAIL_CONFIG.APP_NAME} Seller</strong><br>
      Your trusted marketplace partner</p>
      <p style="font-size: 12px; color: #a0aec0; margin-top: 16px;">
        © ${new Date().getFullYear()} ${EMAIL_CONFIG.APP_NAME}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================
// SEND EMAIL VERIFICATION OTP (onRequest with CORS)
// ============================================================
export const sendEmailVerificationOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Handle preflight
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
      }

      const data = req.body?.data || req.body;
      const { email, userName } = data;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required"
        });
        return;
      }

      // Use userName if provided, otherwise use email prefix
      const displayName = userName || email.split('@')[0];

      log.info(`Sending verification OTP to ${email}`);

      const otp = generateOTP();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 10 * 60 * 1000)
      );

      await admin.firestore().collection("pending_verifications").doc(email).set({
        email,
        otp,
        userName: displayName,
        expiresAt,
        verified: false,
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const transporter = createEmailTransporter();
      const mailOptions = {
        from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: `${otp} is your ${EMAIL_CONFIG.APP_NAME} verification code`,
        html: getWelcomeEmailHTML(displayName, otp)
      };

      await transporter.sendMail(mailOptions);

      log.success(`OTP sent successfully to ${email}`);

      res.status(200).json({
        result: {
          success: true,
          message: "Verification code sent to your email",
          expiresIn: 600
        }
      });
    } catch (err: any) {
      log.error(`Error sending OTP: ${err?.message || err}`);
      res.status(500).json({
        result: {
          success: false,
          message: err?.message || "Failed to send verification email"
        }
      });
    }
  });
});

// ============================================================
// VERIFY EMAIL OTP (onRequest with CORS)
// ============================================================
export const verifyEmailOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
      }

      const data = req.body?.data || req.body;
      const { email, otp } = data;

      if (!email || !otp || otp.length !== 6) {
        res.status(400).json({
          result: { success: false, message: "Email and valid OTP are required" }
        });
        return;
      }

      log.info(`Verifying OTP for ${email}`);

      const docRef = admin.firestore().collection("pending_verifications").doc(email);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({
          result: { success: false, message: "No verification request found" }
        });
        return;
      }

      const verificationData = doc.data();

      if (!verificationData) {
        res.status(404).json({
          result: { success: false, message: "Invalid verification data" }
        });
        return;
      }

      if (verificationData.verified) {
        res.status(400).json({
          result: { success: false, message: "Email already verified" }
        });
        return;
      }

      const now = admin.firestore.Timestamp.now();
      if (verificationData.expiresAt < now) {
        res.status(400).json({
          result: { success: false, message: "Verification code expired" }
        });
        return;
      }

      if (verificationData.attempts >= 5) {
        res.status(429).json({
          result: { success: false, message: "Too many failed attempts. Please request a new code." }
        });
        return;
      }

      if (verificationData.otp !== otp) {
        await docRef.update({
          attempts: admin.firestore.FieldValue.increment(1)
        });
        res.status(400).json({
          result: { success: false, message: "Invalid verification code" }
        });
        return;
      }

      await docRef.update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Email verified successfully for ${email}`);

      res.status(200).json({
        result: {
          success: true,
          message: "Email verified successfully",
          email: email,
          userName: verificationData.userName
        }
      });
    } catch (err: any) {
      log.error(`Error verifying OTP: ${err?.message || err}`);
      res.status(500).json({
        result: { success: false, message: err?.message || "Failed to verify OTP" }
      });
    }
  });
});

// ============================================================
// RESEND VERIFICATION OTP (onRequest with CORS)
// ============================================================
export const resendEmailVerificationOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
      }

      const data = req.body?.data || req.body;
      const { email } = data;

      if (!email) {
        res.status(400).json({
          result: { success: false, message: "Email is required" }
        });
        return;
      }

      log.info(`Resending verification OTP for ${email}`);

      const docRef = admin.firestore().collection("pending_verifications").doc(email);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({
          result: { success: false, message: "No verification request found" }
        });
        return;
      }

      const verificationData = doc.data();

      if (!verificationData) {
        res.status(404).json({
          result: { success: false, message: "Invalid verification data" }
        });
        return;
      }

      if (verificationData.verified) {
        res.status(400).json({
          result: { success: false, message: "Email already verified" }
        });
        return;
      }

      const userName = verificationData.userName;

      if (!userName) {
        res.status(400).json({
          result: { success: false, message: "Invalid verification data" }
        });
        return;
      }

      const otp = generateOTP();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 10 * 60 * 1000)
      );

      await docRef.update({
        otp,
        expiresAt,
        attempts: 0,
        resentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const transporter = createEmailTransporter();
      const mailOptions = {
        from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: `${otp} is your ${EMAIL_CONFIG.APP_NAME} verification code`,
        html: getWelcomeEmailHTML(userName, otp)
      };

      await transporter.sendMail(mailOptions);

      log.success(`OTP resent successfully to ${email}`);

      res.status(200).json({
        result: {
          success: true,
          message: "Verification code resent to your email",
          expiresIn: 600
        }
      });
    } catch (err: any) {
      log.error(`Error resending OTP: ${err?.message || err}`);
      res.status(500).json({
        result: { success: false, message: err?.message || "Failed to resend verification email" }
      });
    }
  });
});

// ============================================================
// SEND SELLER VERIFICATION EMAIL LINK
// ============================================================
export const sendSellerVerificationEmail = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
      }

      const data = req.body?.data || req.body;
      const { email, userName, sellerId } = data;

      if (!email || !userName || !sellerId) {
        res.status(400).json({
          result: { success: false, message: "Email, userName, and sellerId are required" }
        });
        return;
      }

      log.info(`Sending seller verification email to ${email}`);

      // Generate verification token
      const token = generateVerificationToken();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      );

      // Store verification token
      await admin.firestore().collection("seller_email_verifications").doc(sellerId).set({
        email,
        sellerId,
        userName,
        token,
        expiresAt,
        verified: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create verification link
      const verificationLink = `https://seller-letbuy-y.web.app/#/verify-seller-email?token=${token}&sellerId=${sellerId}`;

      // Send email
      const transporter = createEmailTransporter();
      const mailOptions = {
        from: `"${EMAIL_CONFIG.APP_NAME} Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: `Verify your ${EMAIL_CONFIG.APP_NAME} Seller Account`,
        html: getSellerVerificationEmailHTML(userName, verificationLink)
      };

      await transporter.sendMail(mailOptions);

      log.success(`Seller verification email sent to ${email}`);

      res.status(200).json({
        result: {
          success: true,
          message: "Verification email sent successfully",
          expiresIn: 86400 // 24 hours in seconds
        }
      });
    } catch (err: any) {
      log.error(`Error sending seller verification email: ${err?.message || err}`);
      res.status(500).json({
        result: { success: false, message: err?.message || "Failed to send verification email" }
      });
    }
  });
});

// ============================================================
// VERIFY SELLER EMAIL (Link Click Handler)
// ============================================================
export const verifySellerEmail = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Support both GET (query params) and POST (body)
      let token: string | undefined;
      let sellerId: string | undefined;

      if (req.method === 'GET') {
        token = req.query.token as string;
        sellerId = req.query.sellerId as string;
      } else if (req.method === 'POST') {
        token = req.body?.token;
        sellerId = req.body?.sellerId;
      }

      if (!token || !sellerId) {
        if (req.method === 'POST') {
          res.status(400).json({ result: { success: false, message: "Invalid verification link. Missing token or seller ID." } });
        } else {
          res.status(400).send(getVerificationResultHTML(false, "Invalid verification link"));
        }
        return;
      }

      log.info(`Verifying seller email for ${sellerId}`);

      const docRef = admin.firestore().collection("seller_email_verifications").doc(sellerId as string);
      const doc = await docRef.get();

      // Helper to send response based on method
      const sendResponse = (success: boolean, message: string, statusCode: number = 200) => {
        if (req.method === 'POST') {
          res.status(statusCode).json({ result: { success, message } });
        } else {
          res.status(statusCode).send(getVerificationResultHTML(success, message));
        }
      };

      if (!doc.exists) {
        sendResponse(false, "Verification link not found or expired", 404);
        return;
      }

      const verificationData = doc.data();

      if (!verificationData) {
        sendResponse(false, "Invalid verification data", 404);
        return;
      }

      if (verificationData.verified) {
        sendResponse(true, "Email already verified! You can close this page.");
        return;
      }

      const now = admin.firestore.Timestamp.now();
      if (verificationData.expiresAt < now) {
        sendResponse(false, "Verification link has expired. Please request a new one.", 400);
        return;
      }

      if (verificationData.token !== token) {
        sendResponse(false, "Invalid verification token", 400);
        return;
      }

      // Mark as verified
      await docRef.update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update seller document
      await admin.firestore().collection("sellers").doc(sellerId as string).update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Seller email verified successfully for ${sellerId}`);

      sendResponse(true, "Email verified successfully! You can now continue with your KYC.");
    } catch (err: any) {
      log.error(`Error verifying seller email: ${err?.message || err}`);
      if (req.method === 'POST') {
        res.status(500).json({ result: { success: false, message: "Something went wrong. Please try again." } });
      } else {
        res.status(500).send(getVerificationResultHTML(false, "Something went wrong. Please try again."));
      }
    }
  });
});

// ============================================================
// RESEND SELLER VERIFICATION EMAIL
// ============================================================
export const resendSellerVerificationEmail = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
      }

      const data = req.body?.data || req.body;
      const { sellerId } = data;

      if (!sellerId) {
        res.status(400).json({
          result: { success: false, message: "Seller ID is required" }
        });
        return;
      }

      log.info(`Resending seller verification email for ${sellerId}`);

      // Get seller data
      const sellerDoc = await admin.firestore().collection("sellers").doc(sellerId).get();

      if (!sellerDoc.exists) {
        res.status(404).json({
          result: { success: false, message: "Seller not found" }
        });
        return;
      }

      const sellerData = sellerDoc.data();
      if (!sellerData) {
        res.status(404).json({
          result: { success: false, message: "Invalid seller data" }
        });
        return;
      }

      if (sellerData.emailVerified) {
        res.status(400).json({
          result: { success: false, message: "Email already verified" }
        });
        return;
      }

      const email = sellerData.email;
      const userName = sellerData.name || sellerData.storeName || "Seller";

      // Generate new verification token
      const token = generateVerificationToken();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );

      // Update verification document
      await admin.firestore().collection("seller_email_verifications").doc(sellerId).set({
        email,
        sellerId,
        userName,
        token,
        expiresAt,
        verified: false,
        resentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create verification link
      const verificationLink = `https://seller-letbuy-y.web.app/#/verify-seller-email?token=${token}&sellerId=${sellerId}`;

      // Send email
      const transporter = createEmailTransporter();
      const mailOptions = {
        from: `"${EMAIL_CONFIG.APP_NAME} Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: `Verify your ${EMAIL_CONFIG.APP_NAME} Seller Account`,
        html: getSellerVerificationEmailHTML(userName, verificationLink)
      };

      await transporter.sendMail(mailOptions);

      log.success(`Seller verification email resent to ${email}`);

      res.status(200).json({
        result: {
          success: true,
          message: "Verification email resent successfully",
          expiresIn: 86400
        }
      });
    } catch (err: any) {
      log.error(`Error resending seller verification email: ${err?.message || err}`);
      res.status(500).json({
        result: { success: false, message: err?.message || "Failed to resend verification email" }
      });
    }
  });
});

// Helper function to generate verification result HTML page
function getVerificationResultHTML(success: boolean, message: string): string {
  const icon = success ? "✅" : "❌";
  const color = success ? "#10b981" : "#ef4444";
  const bgColor = success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification - ${EMAIL_CONFIG.APP_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container { 
      max-width: 500px; 
      background: white; 
      border-radius: 20px; 
      padding: 48px; 
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
    }
    .icon {
      width: 100px;
      height: 100px;
      background: ${bgColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 48px;
    }
    h1 {
      color: ${color};
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #64748b;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      background: ${EMAIL_CONFIG.BRAND_COLOR};
      color: white;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 10px;
    }
    .logo {
      margin-top: 32px;
      opacity: 0.5;
      font-size: 14px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${success ? "Verification Successful!" : "Verification Failed"}</h1>
    <p>${message}</p>
    ${success ? `<a href="${EMAIL_CONFIG.APP_URL}" class="btn">Open ${EMAIL_CONFIG.APP_NAME}</a>` : ""}
    <div class="logo">${EMAIL_CONFIG.APP_NAME}</div>
  </div>
</body>
</html>
  `;
}

// ============================================================
// 🔥 VERIFY EMAIL OTP AND LOGIN (Marketplace)
// ============================================================
export const verifyEmailOTPAndLogin = functions.https.onCall(async (data, _context) => {
  try {
    const { email, otp } = data;

    if (!email || !otp || otp.length !== 6) {
      throw new functions.https.HttpsError("invalid-argument", "Email and valid 6-digit OTP are required");
    }

    log.info(`Verifying OTP for login: ${email}`);

    const docRef = admin.firestore().collection("pending_verifications").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "No verification request found. Please request a new code.");
    }

    const verificationData = doc.data();

    if (!verificationData) {
      throw new functions.https.HttpsError("not-found", "Invalid verification data");
    }

    // Check expiry
    const now = admin.firestore.Timestamp.now();
    if (verificationData.expiresAt < now) {
      throw new functions.https.HttpsError("deadline-exceeded", "Verification code expired. Please request a new one.");
    }

    // Check attempts
    if (verificationData.attempts >= 5) {
      throw new functions.https.HttpsError("resource-exhausted", "Too many failed attempts. Please request a new code.");
    }

    // Verify OTP
    if (verificationData.otp !== otp) {
      await docRef.update({
        attempts: admin.firestore.FieldValue.increment(1)
      });
      throw new functions.https.HttpsError("invalid-argument", "Invalid verification code");
    }

    // Check if user exists in Firebase Auth
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        throw new functions.https.HttpsError("not-found", "No account found with this email. Please sign up first.");
      }
      throw e;
    }

    // Mark verification as complete
    await docRef.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create custom token for login
    const customToken = await admin.auth().createCustomToken(user.uid);

    log.success(`OTP login successful for ${email}`);

    return {
      success: true,
      uid: user.uid,
      customToken,
      message: "Login successful"
    };
  } catch (err: any) {
    log.error(`Error in verifyEmailOTPAndLogin: ${err?.message || err}`);
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    throw new functions.https.HttpsError("internal", err?.message || "Login failed");
  }
});

// ============================================================
// 🔥 VERIFY EMAIL OTP AND SIGNUP (Marketplace)
// ============================================================
export const verifyEmailOTPAndSignup = functions.https.onCall(async (data, _context) => {
  try {
    const { email, otp, name } = data;

    if (!email || !otp || otp.length !== 6) {
      throw new functions.https.HttpsError("invalid-argument", "Email and valid 6-digit OTP are required");
    }

    if (!name || name.trim().length < 2) {
      throw new functions.https.HttpsError("invalid-argument", "Name is required (minimum 2 characters)");
    }

    log.info(`Verifying OTP for signup: ${email}`);

    const docRef = admin.firestore().collection("pending_verifications").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "No verification request found. Please request a new code.");
    }

    const verificationData = doc.data();

    if (!verificationData) {
      throw new functions.https.HttpsError("not-found", "Invalid verification data");
    }

    // Check expiry
    const now = admin.firestore.Timestamp.now();
    if (verificationData.expiresAt < now) {
      throw new functions.https.HttpsError("deadline-exceeded", "Verification code expired. Please request a new one.");
    }

    // Check attempts
    if (verificationData.attempts >= 5) {
      throw new functions.https.HttpsError("resource-exhausted", "Too many failed attempts. Please request a new code.");
    }

    // Verify OTP
    if (verificationData.otp !== otp) {
      await docRef.update({
        attempts: admin.firestore.FieldValue.increment(1)
      });
      throw new functions.https.HttpsError("invalid-argument", "Invalid verification code");
    }

    // Check if user already exists
    let existingUser;
    let isNewUser = true;
    try {
      existingUser = await admin.auth().getUserByEmail(email);
      isNewUser = false;
      log.info(`User already exists: ${existingUser.uid}`);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        throw e;
      }
    }

    let uid: string;

    if (isNewUser) {
      // Create new user in Firebase Auth (passwordless)
      const userRecord = await admin.auth().createUser({
        email: email,
        displayName: name.trim(),
        emailVerified: true,
      });
      uid = userRecord.uid;

      // Create user document in Firestore
      await admin.firestore().collection("users").doc(uid).set({
        uid,
        email: email.toLowerCase(),
        name: name.trim(),
        role: "user",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: true,
        authMethod: "email_otp"
      });

      // Update email_index
      await admin.firestore().collection("email_index").doc(email.toLowerCase()).set({
        email: email.toLowerCase(),
        type: "user",
        uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`New user created: ${uid}`);
    } else {
      uid = existingUser!.uid;

      // Update last login
      await admin.firestore().collection("users").doc(uid).update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: true
      });
    }

    // Mark verification as complete
    await docRef.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create custom token
    const customToken = await admin.auth().createCustomToken(uid);

    log.success(`OTP signup ${isNewUser ? "completed" : "login"} for ${email}`);

    return {
      success: true,
      uid,
      customToken,
      isNewUser,
      message: isNewUser ? "Account created successfully" : "Login successful"
    };
  } catch (err: any) {
    log.error(`Error in verifyEmailOTPAndSignup: ${err?.message || err}`);
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    throw new functions.https.HttpsError("internal", err?.message || "Signup failed");
  }
});


log.success("✅ Email Verification functions loaded");

