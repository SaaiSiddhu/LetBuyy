import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions";

// Email Configuration
export const EMAIL_CONFIG = {
  APP_NAME: "LetBuyy",
  APP_URL: "https://seller-letbuy-y.web.app",
  BRAND_COLOR: "#0F5257",
  LOGO_URL: "https://seller-letbuy-y.web.app/assets/icons/app_icon.png",
  NO_REPLY_EMAIL: "noreply@letbuyy.com",
  SUPPORT_EMAIL: "support@letbuyy.com"
};

// Create email transporter
export function createEmailTransporter() {
  // Get email credentials from Firebase Functions config
  const emailUser = functions.config().email?.user;
  const emailPass = functions.config().email?.pass;

  if (!emailUser || !emailPass) {
    const errorMsg =
      "Email configuration missing. Please run:\n" +
      "firebase functions:config:set email.user=\"your-email@gmail.com\" email.pass=\"your-app-password\"";
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}