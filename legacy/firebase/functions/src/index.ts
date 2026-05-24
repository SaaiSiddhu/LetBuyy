// ============================================================
// LETBUYY - FIREBASE CLOUD FUNCTIONS INDEX
// Main entry point for all cloud functions
// ============================================================

import * as admin from "firebase-admin";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ============================================================
// IMPORT ALL FUNCTION MODULES
// ============================================================

// Email Verification Functions
export {
  sendEmailVerificationOTP,
  verifyEmailOTP,
  resendEmailVerificationOTP,
  sendSellerVerificationEmail,
  verifySellerEmail,
  resendSellerVerificationEmail,
  verifyEmailOTPAndLogin,     // 🔥 Marketplace OTP Login
  verifyEmailOTPAndSignup,    // 🔥 Marketplace OTP Signup
} from "./emailVerification";

// Admin Authentication Functions (OTP-based)
export {
  sendAdminLoginOTP,
  sendAdminLoginOTPWithGoogle,  // Google Sign-In support
  verifyAdminOTP,
  resendAdminOTP,
  requestAdminPasswordReset,
  verifyAdminResetToken,
  resetAdminPassword,
} from "./adminAuth";

// Admin TOTP 2FA Functions
export {
  initAdminTOTP,
  enableAdminTOTP,
  disableAdminTOTP,
  getAdmin2FAStatus,
  verifyAdminTOTPCode,
} from "./adminTOTP";

// Seller Authentication Functions (OTP-based)
export {
  sendSellerLoginOTP,
  verifySellerOTP,
  resendSellerOTP,
  verifySellerPassword,  // 🔐 Password-based login
  // 🔑 Password Reset
  requestSellerPasswordReset,
  verifySellerResetToken,
  resetSellerPassword,
  registerSellerForOTP,
  // Inline Signup Validation
  checkEmailAvailability,
  sendSignupEmailOTP,
  verifySignupEmailOTP,
  checkPhoneAvailability,
  checkStoreNameAvailability,
} from "./sellerAuth";

// Password Reset Functions
export {
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
  cleanupExpiredResetTokens,
} from "./passwordReset";

// Notification Functions
export {
  sendBroadcastNotification,
  sendNotificationToUser,
  sendOrderUpdateNotification,
  sendNewOrderNotificationToSeller,  // ✅ ADDED: Seller push notification
  getNotificationStats,
  cleanupInvalidTokens,
} from "./notifications";

// KYC Verification Functions
export {
  extractPanDetails,
  extractAadhaarDetails,
  verifyKycNames,
  verifySelfieFaceMatch,
  adminReviewFaceVerification,
  submitKycDocuments,
  adminReviewKyc,
  updateSellerStatus,  // ✅ ADDED: Seller status updates with email/push
} from "./kycVerification";

// Admin Profile Management Functions
export {
  initiateAdminEmailChange,
  verifyCurrentEmailOTP,
  completeAdminEmailChange,
  updateAdminProfile,
} from "./adminProfile";

// Bank IFSC Search Functions
export {
  searchIfscCodes,
  getDistrictsByState,
} from "./bankIfscSearch";

// Wallet & Payout Service Functions
export {
  onOrderDelivered,
  requestWithdrawal,
  adminProcessPayout,
  resetWeeklyLimits,
  processAutoPayouts,
  getSellerWalletStats,
} from "./walletService";

// Return & Exchange Service Functions
export {
  onReturnRequested,
  onReturnStatusChanged,
  autoRejectStaleReturns,
  processReturnRefund,
  createExchangeOrder,
  getReturnAnalytics,
} from "./returnService";

// Store Builder Authentication Functions
export {
  sendStoreAuthRequest,
  sendStoreAuthNotification,
  approveStoreAuth,
  rejectStoreAuth,
  checkSubdomainAvailability,
  cleanupExpiredAuthRequests,
} from "./storeAuth";

// Store Deployment Functions (Firebase Hosting)
export {
  deployStore,
  serveStore,
} from "./storeDeployment";

// Razorpay Payment Service Functions
export {
  createRazorpayOrder,
  verifyPaymentSignature,
  validateVPA,
  saveCardToken,
  getSavedCards,
  deleteSavedCard,
} from "./razorpayService";

// Commission Service Functions
export {
  calculateOrderCommission,
  processDeliveredOrderCommission,
  handleReturnCommission,
  updateSellerTiers,
  releaseHeldPayouts,
  getCommissionAnalytics,
} from "./commissionService";

// Settlement & Invoice Service Functions
export {
  generateSettlementInvoice,
  applyRTOCharges,
  processWeeklyPayouts,
  getSellerSettlementSummary,
  adminUpdateInvoiceStatus,
} from "./settlementService";

// Seller Analytics Service Functions
export {
  onAnalyticsEvent,
  aggregateAnalyticsHourly,
  aggregateAnalyticsDaily,
  triggerAnalyticsAggregation,
  getSellerAnalytics,
} from "./analyticsService";

// Domain Mapping Service Functions (Simplified for Vercel + Cloudflare)
export {
  onStorePublished,          // Updates Firestore status on publish
  markStoreAsLive,           // Manual trigger if needed
} from "./domainMapping";


// Order Notification Triggers (Auto-notify sellers on new orders)
export {
  onOrderCreated,
} from "./orderNotifications";

// Subscription & SaaS Service Functions
export {
  createSubscription,
  checkTrialStatus,
  freezeStore,
  enforceProductLimit,
  decrementProductCount,
  connectOwnRazorpay,
  getPaymentConfigForOrder,
  upgradeSubscription,
} from "./subscriptionService";

// Subscription Webhook Handler (Razorpay Events)
export {
  processSubscriptionPayment,
} from "./subscriptionWebhook";

// ============================================================
// INITIALIZATION LOG
// ============================================================
console.log("🚀 LetBuyy Cloud Functions initialized successfully!");
console.log("📧 Email Verification: Enabled");
console.log("🔐 Admin Auth (OTP): Enabled");
console.log("🏪 Seller Auth (OTP): Enabled");
console.log("🔑 Password Reset: Enabled");
console.log("🔔 Notifications: Enabled");
console.log("🆔 KYC Verification: Enabled");
console.log("👤 Admin Profile: Enabled");
console.log("💰 Wallet & Payout Service: Enabled");
console.log("📦 Return & Exchange Service: Enabled");
console.log("🏬 Store Builder Auth: Enabled");
console.log("🌐 Store Deployment: Enabled");
console.log("💳 Razorpay Payment Service: Enabled");
console.log("📊 Commission Service: Enabled");
console.log("📄 Settlement & Invoice Service: Enabled");
console.log("📈 Seller Analytics Service: Enabled");

