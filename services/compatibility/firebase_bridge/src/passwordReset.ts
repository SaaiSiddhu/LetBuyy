import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

const log = {
  info: (msg: string) => console.log(`ℹ️ [PasswordReset] ${msg}`),
  success: (msg: string) => console.log(`✅ [PasswordReset] ${msg}`),
  error: (msg: string) => console.error(`❌ [PasswordReset] ${msg}`),
};

// ============================================================
// GENERATE SECURE RESET TOKEN
// ============================================================
function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ============================================================
// PASSWORD RESET EMAIL TEMPLATE
// ============================================================
function getPasswordResetEmailHTML(userName: string, resetLink: string, expiryMinutes: number): string {
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
    .header-icon {
      font-size: 48px;
      margin-bottom: 12px;
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
    .reset-box { 
      background: linear-gradient(135deg, rgba(15, 82, 87, 0.08) 0%, rgba(10, 61, 65, 0.12) 100%); 
      border: 2px solid ${EMAIL_CONFIG.BRAND_COLOR}; 
      border-radius: 12px; 
      padding: 32px; 
      text-align: center; 
      margin: 30px 0; 
    }
    .reset-button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR} 0%, #0a3d41 100%); 
      color: white; 
      text-decoration: none; 
      padding: 16px 48px; 
      border-radius: 10px; 
      font-weight: 700; 
      font-size: 16px; 
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(15, 82, 87, 0.3);
      transition: all 0.3s ease;
    }
    .reset-button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(15, 82, 87, 0.4);
    }
    .validity-text { 
      font-size: 14px; 
      color: #e53e3e; 
      margin-top: 20px; 
      font-weight: 600;
    }
    .alternative-link {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px dashed #e2e8f0;
    }
    .alternative-link p {
      font-size: 13px;
      color: #718096;
      margin-bottom: 12px;
    }
    .link-box {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      word-break: break-all;
      font-size: 12px;
      color: ${EMAIL_CONFIG.BRAND_COLOR};
      font-family: 'Courier New', monospace;
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
    .security-icon {
      display: inline-block;
      margin-right: 8px;
      font-size: 18px;
    }
    .warning-box {
      background: #fff5f5;
      border-left: 4px solid #e53e3e;
      padding: 16px 20px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .warning-box p {
      color: #c53030;
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
    .footer a:hover { 
      text-decoration: underline; 
    }
    @media only screen and (max-width: 600px) {
      .container { margin: 20px auto; }
      .header { padding: 30px 20px; }
      .content { padding: 30px 20px; }
      .reset-button { padding: 14px 32px; font-size: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${EMAIL_CONFIG.LOGO_URL}" alt="${EMAIL_CONFIG.APP_NAME}" class="logo">
      <div class="header-icon">🔐</div>
      <h1>Password Reset Request</h1>
      <p>Secure your account</p>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${userName},</div>
      
      <p class="text">
        We received a request to reset the password for your <strong>${EMAIL_CONFIG.APP_NAME}</strong> account. 
        If you made this request, click the button below to securely reset your password.
      </p>
      
      <div class="reset-box">
        <a href="${resetLink}" class="reset-button">Reset My Password</a>
        <div class="validity-text">⏱️ This link expires in ${expiryMinutes} minutes</div>
        
        <div class="alternative-link">
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <div class="link-box">${resetLink}</div>
        </div>
      </div>
      
      <div class="security-note">
        <p>
          <span class="security-icon">🔒</span>
          <strong>Security Reminder:</strong> This password reset link is unique to your account. 
          Never share it with anyone. ${EMAIL_CONFIG.APP_NAME} will never ask you to share this link.
        </p>
      </div>
      
      <div class="warning-box">
        <p>
          <span class="security-icon">⚠️</span>
          <strong>Didn't request this?</strong> If you didn't request a password reset, 
          please ignore this email or <a href="mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}" style="color: #c53030; font-weight: 600;">contact support immediately</a>. 
          Your password will remain unchanged.
        </p>
      </div>
      
      <div class="divider"></div>
      
      <p class="text" style="font-size: 14px; color: #718096;">
        For security reasons, this reset link can only be used once. If you need to reset your password again, 
        you'll need to submit another request.
      </p>
    </div>
    
    <div class="footer">
      <p>
        <strong>${EMAIL_CONFIG.APP_NAME}</strong><br>
        Your trusted marketplace for everything<br>
        <a href="${EMAIL_CONFIG.APP_URL}">${EMAIL_CONFIG.APP_URL}</a>
      </p>
      
      <div class="divider"></div>
      
      <p style="font-size: 12px; color: #a0aec0;">
        This is an automated message, please do not reply.<br>
        For support, email us at <a href="mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}">${EMAIL_CONFIG.SUPPORT_EMAIL}</a>
      </p>
      
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
// 1️⃣ REQUEST PASSWORD RESET (No Auth Required)
// ============================================================
export const requestPasswordReset = functions.https.onCall(
  async (data: { email: string }) => {
    try {
      const { email } = data;

      if (!email || !email.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Email is required");
      }

      const emailLower = email.trim().toLowerCase();
      log.info(`Password reset requested for ${emailLower}`);

      // Check if user exists
      const usersRef = admin.firestore().collection("users");
      const userQuery = await usersRef.where("email", "==", emailLower).limit(1).get();

      if (userQuery.empty) {
        // For security, don't reveal if email exists
        log.info(`User not found for email ${emailLower}, but returning success`);
        return {
          success: true,
          message: "If an account with this email exists, a password reset link has been sent.",
        };
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userName = userData.name || "User";

      // Generate secure token
      const resetToken = generateResetToken();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      );

      // Store reset request
      await admin.firestore().collection("password_resets").doc(userId).set({
        email: emailLower,
        token: resetToken,
        userId,
        expiresAt,
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create reset link
      const resetLink = `${EMAIL_CONFIG.APP_URL}/reset-password?token=${resetToken}&uid=${userId}`;

      // Send email
      const transporter = createEmailTransporter();
      const mailOptions = {
        from: `"${EMAIL_CONFIG.APP_NAME} Security" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: emailLower,
        subject: `Reset your ${EMAIL_CONFIG.APP_NAME} password`,
        html: getPasswordResetEmailHTML(userName, resetLink, 30),
      };

      await transporter.sendMail(mailOptions);

      log.success(`Password reset email sent to ${emailLower}`);

      return {
        success: true,
        message: "If an account with this email exists, a password reset link has been sent.",
      };
    } catch (err: any) {
      log.error(`Error requesting password reset: ${err?.message || err}`);
      
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      
      throw new functions.https.HttpsError("internal", "Failed to process password reset request");
    }
  }
);

// ============================================================
// 2️⃣ VERIFY RESET TOKEN (No Auth Required)
// ============================================================
export const verifyResetToken = functions.https.onCall(
  async (data: { token: string; userId: string }) => {
    try {
      const { token, userId } = data;

      if (!token || !userId) {
        throw new functions.https.HttpsError("invalid-argument", "Token and userId are required");
      }

      log.info(`Verifying reset token for user ${userId}`);

      const docRef = admin.firestore().collection("password_resets").doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Invalid or expired reset link");
      }

      const resetData = doc.data();

      // Check if already used
      if (resetData?.used) {
        throw new functions.https.HttpsError("failed-precondition", "This reset link has already been used");
      }

      // Check expiration
      const now = admin.firestore.Timestamp.now();
      if (resetData?.expiresAt < now) {
        throw new functions.https.HttpsError("deadline-exceeded", "This reset link has expired");
      }

      // Verify token
      if (resetData?.token !== token) {
        throw new functions.https.HttpsError("permission-denied", "Invalid reset link");
      }

      log.success(`Reset token verified for user ${userId}`);

      return {
        success: true,
        message: "Reset token is valid",
        email: resetData.email,
      };
    } catch (err: any) {
      log.error(`Error verifying reset token: ${err?.message || err}`);
      
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      
      throw new functions.https.HttpsError("internal", "Failed to verify reset token");
    }
  }
);

// ============================================================
// 3️⃣ RESET PASSWORD (No Auth Required)
// ============================================================
export const resetPassword = functions.https.onCall(
  async (data: { token: string; userId: string; newPassword: string }) => {
    try {
      const { token, userId, newPassword } = data;

      if (!token || !userId || !newPassword) {
        throw new functions.https.HttpsError("invalid-argument", "Token, userId, and newPassword are required");
      }

      // Validate password strength
      if (newPassword.length < 8) {
        throw new functions.https.HttpsError("invalid-argument", "Password must be at least 8 characters");
      }

      log.info(`Resetting password for user ${userId}`);

      const docRef = admin.firestore().collection("password_resets").doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Invalid or expired reset link");
      }

      const resetData = doc.data();

      // Verify token and expiration
      if (resetData?.used) {
        throw new functions.https.HttpsError("failed-precondition", "This reset link has already been used");
      }

      const now = admin.firestore.Timestamp.now();
      if (resetData?.expiresAt < now) {
        throw new functions.https.HttpsError("deadline-exceeded", "This reset link has expired");
      }

      if (resetData?.token !== token) {
        throw new functions.https.HttpsError("permission-denied", "Invalid reset link");
      }

      // Update password in Firebase Auth
      await admin.auth().updateUser(userId, {
        password: newPassword,
      });

      // Mark token as used
      await docRef.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user document
      await admin.firestore().collection("users").doc(userId).update({
        passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      log.success(`Password reset successfully for user ${userId}`);

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (err: any) {
      log.error(`Error resetting password: ${err?.message || err}`);
      
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      
      throw new functions.https.HttpsError("internal", "Failed to reset password");
    }
  }
);

// ============================================================
// 4️⃣ CLEANUP EXPIRED RESET TOKENS (Scheduled)
// ============================================================
export const cleanupExpiredResetTokens = functions.pubsub
  .schedule("every day 02:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    try {
      log.info("Starting cleanup of expired password reset tokens");

      const now = admin.firestore.Timestamp.now();
      const expiredTokens = await admin
        .firestore()
        .collection("password_resets")
        .where("expiresAt", "<", now)
        .get();

      if (expiredTokens.empty) {
        log.info("No expired tokens to clean up");
        return { success: true, deleted: 0 };
      }

      const batch = admin.firestore().batch();
      expiredTokens.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      log.success(`Deleted ${expiredTokens.size} expired reset tokens`);

      return { success: true, deleted: expiredTokens.size };
    } catch (err: any) {
      log.error(`Cleanup error: ${err?.message || err}`);
      return { success: false, error: err?.message || String(err) };
    }
  });

log.success("✅ Password Reset functions loaded");
