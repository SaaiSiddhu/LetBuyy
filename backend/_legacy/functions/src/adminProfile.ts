import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

const cors = require("cors")({ origin: true });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailChangeOTPHTML(otp: string, isCurrentEmail: boolean): string {
    const title = isCurrentEmail
        ? "Verify Your Identity"
        : "Confirm New Email";
    const description = isCurrentEmail
        ? "We received a request to change your admin email. Enter this code to verify your identity."
        : "Enter this code to confirm your new email address.";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
      background: #f1f5f9; 
      padding: 40px 20px;
    }
    .container { 
      max-width: 480px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header { 
      background: linear-gradient(135deg, #0f5257, #0a3d41); 
      padding: 32px; 
      text-align: center;
    }
    .header h1 { 
      color: white; 
      font-size: 22px; 
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      color: rgba(255,255,255,0.8);
      font-size: 14px;
    }
    .content { 
      padding: 32px; 
    }
    .description {
      color: #64748b;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
      text-align: center;
    }
    .otp-box { 
      background: #f8fafc;
      border: 2px dashed #0f5257;
      border-radius: 12px; 
      padding: 24px; 
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-label {
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .otp-code { 
      font-size: 36px; 
      font-weight: 700; 
      color: #0f5257;
      letter-spacing: 8px;
      font-family: monospace;
    }
    .timer {
      color: #f59e0b;
      font-size: 13px;
      font-weight: 500;
      text-align: center;
    }
    .footer { 
      padding: 24px; 
      text-align: center; 
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .footer p { 
      color: #94a3b8; 
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>LetBuyy Admin Portal</p>
    </div>
    <div class="content">
      <p class="description">${description}</p>
      <div class="otp-box">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${otp}</div>
      </div>
      <p class="timer">⏱ Expires in 10 minutes</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} LetBuyy • Do not share this code</p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================

/**
 * Step 1: Send OTP to current email to initiate email change
 */
export const initiateAdminEmailChange = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { currentEmail, newEmail, adminId } = req.body;

            if (!currentEmail || !newEmail || !adminId) {
                res.status(400).json({
                    success: false,
                    error: "Current email, new email, and admin ID are required"
                });
                return;
            }

            // Verify admin exists and email matches
            const adminDoc = await admin.firestore().collection("admins").doc(adminId).get();
            if (!adminDoc.exists) {
                res.status(404).json({ success: false, error: "Admin not found" });
                return;
            }

            const adminData = adminDoc.data();
            if (adminData?.email !== currentEmail) {
                res.status(400).json({ success: false, error: "Current email does not match" });
                return;
            }

            // Check if new email is already in use
            const existingAdmin = await admin.firestore()
                .collection("admins")
                .where("email", "==", newEmail)
                .get();

            if (!existingAdmin.empty) {
                res.status(400).json({ success: false, error: "New email is already in use" });
                return;
            }

            // Generate OTP and store
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await admin.firestore().collection("emailChangeOTPs").doc(adminId).set({
                currentEmail,
                newEmail,
                otpCurrentEmail: otp,
                otpNewEmail: null,
                step: 1, // Step 1: Verify current email
                expiresAt,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                currentEmailVerified: false,
                newEmailVerified: false,
            });

            // Send OTP to current email
            const transporter = await createEmailTransporter();
            await transporter.sendMail({
                from: `"LetBuyy Admin" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: currentEmail,
                subject: "🔐 Verify Email Change - LetBuyy Admin",
                html: getEmailChangeOTPHTML(otp, true),
            });

            res.status(200).json({
                success: true,
                message: "OTP sent to current email",
                step: 1,
                expiresIn: 600,
            });
        } catch (error: any) {
            console.error("Error initiating email change:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Step 2: Verify current email OTP and send OTP to new email
 */
export const verifyCurrentEmailOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { adminId, otp } = req.body;

            if (!adminId || !otp) {
                res.status(400).json({ success: false, error: "Admin ID and OTP are required" });
                return;
            }

            // Get OTP record
            const otpDoc = await admin.firestore().collection("emailChangeOTPs").doc(adminId).get();
            if (!otpDoc.exists) {
                res.status(404).json({ success: false, error: "No pending email change request" });
                return;
            }

            const otpData = otpDoc.data()!;

            // Check expiry
            if (new Date() > otpData.expiresAt.toDate()) {
                await otpDoc.ref.delete();
                res.status(401).json({ success: false, error: "OTP expired. Please start again." });
                return;
            }

            // Verify OTP
            if (otpData.otpCurrentEmail !== otp) {
                res.status(401).json({ success: false, error: "Invalid OTP" });
                return;
            }

            // Generate new OTP for new email
            const newOtp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await otpDoc.ref.update({
                otpNewEmail: newOtp,
                step: 2,
                currentEmailVerified: true,
                expiresAt,
            });

            // Send OTP to new email
            const transporter = await createEmailTransporter();
            await transporter.sendMail({
                from: `"LetBuyy Admin" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: otpData.newEmail,
                subject: "🔐 Confirm New Email - LetBuyy Admin",
                html: getEmailChangeOTPHTML(newOtp, false),
            });

            res.status(200).json({
                success: true,
                message: "Current email verified. OTP sent to new email.",
                step: 2,
                newEmail: otpData.newEmail,
                expiresIn: 600,
            });
        } catch (error: any) {
            console.error("Error verifying current email OTP:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Step 3: Verify new email OTP and complete email change
 */
export const completeAdminEmailChange = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { adminId, otp } = req.body;

            if (!adminId || !otp) {
                res.status(400).json({ success: false, error: "Admin ID and OTP are required" });
                return;
            }

            // Get OTP record
            const otpDoc = await admin.firestore().collection("emailChangeOTPs").doc(adminId).get();
            if (!otpDoc.exists) {
                res.status(404).json({ success: false, error: "No pending email change request" });
                return;
            }

            const otpData = otpDoc.data()!;

            // Check step
            if (otpData.step !== 2 || !otpData.currentEmailVerified) {
                res.status(400).json({ success: false, error: "Please verify current email first" });
                return;
            }

            // Check expiry
            if (new Date() > otpData.expiresAt.toDate()) {
                await otpDoc.ref.delete();
                res.status(401).json({ success: false, error: "OTP expired. Please start again." });
                return;
            }

            // Verify OTP
            if (otpData.otpNewEmail !== otp) {
                res.status(401).json({ success: false, error: "Invalid OTP" });
                return;
            }

            // Update email in Firestore
            await admin.firestore().collection("admins").doc(adminId).update({
                email: otpData.newEmail,
                emailChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update Firebase Auth email
            try {
                const userRecord = await admin.auth().getUserByEmail(otpData.currentEmail);
                await admin.auth().updateUser(userRecord.uid, {
                    email: otpData.newEmail,
                });
            } catch (authError) {
                console.error("Firebase Auth update failed:", authError);
                // Continue - Firestore is source of truth for admins
            }

            // Delete OTP record
            await otpDoc.ref.delete();

            // Log the change
            await admin.firestore().collection("adminActivityLogs").add({
                adminId,
                action: "EMAIL_CHANGED",
                oldEmail: otpData.currentEmail,
                newEmail: otpData.newEmail,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            res.status(200).json({
                success: true,
                message: "Email changed successfully",
                newEmail: otpData.newEmail,
            });
        } catch (error: any) {
            console.error("Error completing email change:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update admin profile (name, etc.)
 */
export const updateAdminProfile = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { adminId, name, displayName } = req.body;

            if (!adminId) {
                res.status(400).json({ success: false, error: "Admin ID is required" });
                return;
            }

            const updateData: Record<string, any> = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (name) updateData.name = name;
            if (displayName) updateData.displayName = displayName;

            await admin.firestore().collection("admins").doc(adminId).update(updateData);

            res.status(200).json({
                success: true,
                message: "Profile updated successfully",
            });
        } catch (error: any) {
            console.error("Error updating profile:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
