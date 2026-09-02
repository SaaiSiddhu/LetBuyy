// functions/src/kycVerification.ts
// Advanced KYC Verification with ML OCR and Face Matching

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import cors from "cors";
import * as crypto from "crypto";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

// Initialize Vision API client
const visionClient = new ImageAnnotatorClient();
const corsHandler = cors({ origin: true });

// ============================================================
// SECURITY: Hash sensitive data (PAN, Aadhaar numbers)
// ============================================================
function hashSensitiveData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Mask sensitive numbers for display (e.g., "XXXX XXXX 1234")
function maskNumber(num: string, visibleDigits: number = 4): string {
    if (!num) return '';
    const cleaned = num.replace(/\s/g, '');
    if (cleaned.length <= visibleDigits) return cleaned;
    const masked = 'X'.repeat(cleaned.length - visibleDigits);
    return masked + cleaned.slice(-visibleDigits);
}

// ============================================================
// SECURITY: Upload file privately and get signed URL
// ============================================================
async function uploadPrivateFile(
    storage: any,
    filePath: string,
    buffer: Buffer,
    contentType: string
): Promise<{ gcsPath: string; signedUrl: string }> {
    const file = storage.file(filePath);

    // Save file WITHOUT public access
    await file.save(buffer, {
        contentType,
        metadata: {
            cacheControl: 'private, max-age=0',
            // Custom metadata for document type tracking
            documentType: 'kyc',
            uploadedAt: new Date().toISOString()
        }
    });

    // Generate signed URL valid for 7 days (for admin review)
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
        gcsPath: `gs://${storage.name}/${filePath}`,
        signedUrl
    };
}

// Logging helper
const log = {
    info: (msg: string) => console.log(`ℹ️ [KYC] ${msg}`),
    success: (msg: string) => console.log(`✅ [KYC] ${msg}`),
    error: (msg: string) => console.error(`❌ [KYC] ${msg}`),
    warn: (msg: string) => console.warn(`⚠️ [KYC] ${msg}`)
};

// ============================================================
// PAN CARD PATTERNS
// ============================================================
const PAN_PATTERNS = {
    // PAN format: XXXXX1234X (5 letters, 4 digits, 1 letter)
    number: /[A-Z]{5}[0-9]{4}[A-Z]/g,
    // Common name patterns on PAN
    nameLabel: /(?:name|नाम)\s*[:\-]?\s*/i,
    fatherNameLabel: /(?:father'?s?\s*name|पिता का नाम)\s*[:\-]?\s*/i,
    dobLabel: /(?:date\s*of\s*birth|d\.?o\.?b\.?|जन्म\s*तिथि)\s*[:\-]?\s*/i
};

// ============================================================
// AADHAAR PATTERNS
// ============================================================
const AADHAAR_PATTERNS = {
    // Aadhaar: 12 digits (often formatted as XXXX XXXX XXXX)
    number: /\b\d{4}\s*\d{4}\s*\d{4}\b/g,
    // VID (Virtual ID): 16 digits
    vid: /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/g,
    // DOB patterns
    dob: /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/g,
    // Gender
    gender: /\b(male|female|पुरुष|महिला|transgender)\b/i,
    // PIN code
    pincode: /\b\d{6}\b/g
};

// ============================================================
// HELPER: Extract text from image using Vision API
// ============================================================
async function extractTextFromImage(imageBase64: string): Promise<string> {
    try {
        const [result] = await visionClient.textDetection({
            image: { content: imageBase64 }
        });

        const detections = result.textAnnotations;
        if (detections && detections.length > 0) {
            // First detection contains the full text
            return detections[0].description || "";
        }
        return "";
    } catch (err: any) {
        log.error(`Vision API error: ${err?.message || err}`);
        throw new Error("Failed to process image");
    }
}

// ============================================================
// HELPER: Extract PAN details from text
// ============================================================
function extractPanFromText(fullText: string): {
    panNumber: string | null;
    name: string | null;
    fatherName: string | null;
    dob: string | null;
} {
    const result = {
        panNumber: null as string | null,
        name: null as string | null,
        fatherName: null as string | null,
        dob: null as string | null
    };

    // Extract PAN number
    const panMatches = fullText.match(PAN_PATTERNS.number);
    if (panMatches && panMatches.length > 0) {
        result.panNumber = panMatches[0];
    }

    // Split text into lines for structured parsing
    const lines = fullText.split("\n").map(l => l.trim()).filter(l => l);

    log.info(`PAN OCR Lines: ${JSON.stringify(lines)}`);

    // Strategy: Find lines that are ONLY English capital letters (actual names)
    // These will be the real names, not labels like "नाम / Name"
    const englishNameLines: string[] = [];
    const labelIndicators = ['name', 'नाम', 'पिता', 'father', 'birth', 'date', 'dob', 'permanent', 'account', 'income', 'tax', 'department', 'government', 'india', 'signature', 'number', 'card', 'भारत', 'सरकार', 'आयकर', 'विभाग', 'जन्म', 'तिथि', 'हस्ताक्षर'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();

        // Skip if contains any label indicator
        const isLabel = labelIndicators.some(ind => lineLower.includes(ind));
        if (isLabel) continue;

        // Skip if contains PAN number
        if (PAN_PATTERNS.number.test(line)) continue;

        // Skip if contains date pattern
        if (/\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(line)) continue;

        // Skip if too short
        if (line.length < 3) continue;

        // Skip if has Hindi characters (labels are bilingual)
        if (/[\u0900-\u097F]/.test(line)) continue;

        // Check if it's a name: Only English letters and spaces, looks like a name
        if (/^[A-Z][A-Z\s]+$/.test(line) && line.split(' ').length <= 5) {
            englishNameLines.push(line);
        }
    }

    log.info(`Found English name lines: ${JSON.stringify(englishNameLines)}`);

    // First English name line is typically the person's name
    // Second is typically father's name
    if (englishNameLines.length >= 1) {
        result.name = englishNameLines[0];
    }
    if (englishNameLines.length >= 2) {
        result.fatherName = englishNameLines[1];
    }

    // Extract DOB - look for date pattern
    const dobMatch = fullText.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
    if (dobMatch) {
        result.dob = dobMatch[0];
    }

    return result;
}

// ============================================================
// HELPER: Extract Aadhaar details from text
// ============================================================
function extractAadhaarFromText(fullText: string): {
    aadhaarNumber: string | null;
    name: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
} {
    const result = {
        aadhaarNumber: null as string | null,
        name: null as string | null,
        dob: null as string | null,
        gender: null as string | null,
        address: null as string | null
    };

    // Extract Aadhaar number (12 digits)
    const aadhaarMatches = fullText.match(AADHAAR_PATTERNS.number);
    if (aadhaarMatches && aadhaarMatches.length > 0) {
        // Clean up: remove spaces
        result.aadhaarNumber = aadhaarMatches[0].replace(/\s/g, "");
        // Validate: should be exactly 12 digits
        if (result.aadhaarNumber.length !== 12) {
            result.aadhaarNumber = null;
        }
    }

    // Extract DOB
    const dobMatches = fullText.match(AADHAAR_PATTERNS.dob);
    if (dobMatches && dobMatches.length > 0) {
        result.dob = dobMatches[0];
    }

    // Extract Gender
    const genderMatch = fullText.match(AADHAAR_PATTERNS.gender);
    if (genderMatch) {
        const g = genderMatch[0].toLowerCase();
        if (g === "male" || g === "पुरुष") result.gender = "Male";
        else if (g === "female" || g === "महिला") result.gender = "Female";
        else result.gender = "Other";
    }

    // Extract name - typically bold/large text after "Government of India"
    const lines = fullText.split("\n").map(l => l.trim()).filter(l => l);

    // Look for name patterns
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip common headers
        if (/government|india|aadhaar|आधार|भारत|सरकार|unique|identification/i.test(line)) {
            continue;
        }

        // Skip lines with numbers (DOB, Aadhaar number, etc.)
        if (/\d{4}/.test(line)) continue;

        // Skip gender lines
        if (AADHAAR_PATTERNS.gender.test(line)) continue;

        // Name is usually a line with only letters and spaces, 3+ chars
        if (/^[A-Za-z\s]+$/.test(line) && line.length > 3 && line.split(" ").length <= 5) {
            result.name = line.toUpperCase();
            break;
        }
    }

    // Extract address (usually multi-line after name)
    const addressKeywords = ["s/o", "d/o", "w/o", "c/o", "house", "street", "road", "nagar", "colony"];
    const addressLines: string[] = [];
    let inAddress = false;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (addressKeywords.some(kw => lowerLine.includes(kw))) {
            inAddress = true;
        }
        if (inAddress && !AADHAAR_PATTERNS.number.test(line)) {
            addressLines.push(line);
            if (AADHAAR_PATTERNS.pincode.test(line)) break; // Address ends at pincode
        }
    }

    if (addressLines.length > 0) {
        result.address = addressLines.join(", ");
    }

    return result;
}

// ============================================================
// HELPER: Calculate name similarity (fuzzy matching)
// ============================================================
function calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    // Normalize names
    const n1 = name1.toUpperCase().trim().replace(/\s+/g, " ");
    const n2 = name2.toUpperCase().trim().replace(/\s+/g, " ");

    if (n1 === n2) return 100;

    // Split into words
    const words1 = n1.split(" ").filter(w => w.length > 1);
    const words2 = n2.split(" ").filter(w => w.length > 1);

    // Count matching words
    let matches = 0;
    let partialMatches = 0;

    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2) {
                matches++;
                break;
            }
            // Partial match (handles abbreviations like "SURESH" vs "S")
            if (w1.startsWith(w2) || w2.startsWith(w1)) {
                partialMatches += 0.5;
                break;
            }
            // Levenshtein distance for typos
            const distance = levenshteinDistance(w1, w2);
            if (distance <= 2 && w1.length > 4) {
                partialMatches += 0.7;
                break;
            }
        }
    }

    const totalWords = Math.max(words1.length, words2.length);
    const score = ((matches + partialMatches) / totalWords) * 100;

    return Math.round(Math.min(100, score));
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    return dp[m][n];
}

// ============================================================
// CLOUD FUNCTION: Extract PAN Details
// ============================================================
export const extractPanDetails = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { imageBase64, sellerId } = req.body;

            if (!imageBase64) {
                res.status(400).json({ result: { success: false, message: "Image is required" } });
                return;
            }

            log.info(`Extracting PAN details${sellerId ? ` for seller ${sellerId}` : ""}`);

            // Extract text using Vision API
            const fullText = await extractTextFromImage(imageBase64);
            log.info(`OCR extracted ${fullText.length} characters`);

            // Parse PAN details
            const panDetails = extractPanFromText(fullText);

            if (!panDetails.panNumber) {
                log.warn("Could not detect PAN number in image");
                res.status(200).json({
                    result: {
                        success: false,
                        message: "Could not detect PAN number. Please ensure the image is clear.",
                        rawText: fullText.substring(0, 500)
                    }
                });
                return;
            }

            log.success(`Extracted PAN: ${panDetails.panNumber}, Name: ${panDetails.name}`);

            // Store extraction in Firestore if sellerId provided
            if (sellerId) {
                await admin.firestore().collection("kyc_extractions").doc(sellerId).set({
                    panDetails,
                    panExtractedAt: admin.firestore.FieldValue.serverTimestamp(),
                    rawText: fullText
                }, { merge: true });
            }

            res.status(200).json({
                result: {
                    success: true,
                    data: panDetails,
                    confidence: panDetails.name ? 0.9 : 0.7
                }
            });

        } catch (err: any) {
            log.error(`Error extracting PAN: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to process image" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Extract Aadhaar Details
// ============================================================
export const extractAadhaarDetails = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { imageBase64, sellerId, side = "front" } = req.body;

            if (!imageBase64) {
                res.status(400).json({ result: { success: false, message: "Image is required" } });
                return;
            }

            log.info(`Extracting Aadhaar (${side}) details${sellerId ? ` for seller ${sellerId}` : ""}`);

            // Extract text using Vision API
            const fullText = await extractTextFromImage(imageBase64);
            log.info(`OCR extracted ${fullText.length} characters`);

            // Parse Aadhaar details
            const aadhaarDetails = extractAadhaarFromText(fullText);

            if (!aadhaarDetails.aadhaarNumber && side === "front") {
                log.warn("Could not detect Aadhaar number in image");
                res.status(200).json({
                    result: {
                        success: false,
                        message: "Could not detect Aadhaar number. Please ensure the image is clear.",
                        rawText: fullText.substring(0, 500)
                    }
                });
                return;
            }

            log.success(`Extracted Aadhaar: ${aadhaarDetails.aadhaarNumber}, Name: ${aadhaarDetails.name}`);

            // Store extraction if sellerId provided
            if (sellerId) {
                const updateData: any = {
                    [`aadhaarDetails_${side}`]: aadhaarDetails,
                    [`aadhaarExtractedAt_${side}`]: admin.firestore.FieldValue.serverTimestamp()
                };
                await admin.firestore().collection("kyc_extractions").doc(sellerId).set(updateData, { merge: true });
            }

            res.status(200).json({
                result: {
                    success: true,
                    data: aadhaarDetails,
                    confidence: aadhaarDetails.name ? 0.85 : 0.6
                }
            });

        } catch (err: any) {
            log.error(`Error extracting Aadhaar: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to process image" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Verify KYC Names Match
// ============================================================
export const verifyKycNames = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { panName, aadhaarName, sellerId } = req.body;

            if (!panName || !aadhaarName) {
                res.status(400).json({ result: { success: false, message: "Both PAN and Aadhaar names are required" } });
                return;
            }

            log.info(`Comparing names: "${panName}" vs "${aadhaarName}"`);

            const similarity = calculateNameSimilarity(panName, aadhaarName);
            const isMatch = similarity >= 80;

            log.info(`Name similarity: ${similarity}%, isMatch: ${isMatch}`);

            // Determine status
            let status: "match" | "partial" | "mismatch";
            let message: string;

            if (similarity >= 90) {
                status = "match";
                message = "Names match perfectly";
            } else if (similarity >= 70) {
                status = "partial";
                message = "Names partially match - minor variations detected";
            } else {
                status = "mismatch";
                message = "Names do not match - please verify documents";
            }

            // Store verification result if sellerId provided
            if (sellerId) {
                await admin.firestore().collection("kyc_verifications").doc(sellerId).set({
                    nameVerification: {
                        panName,
                        aadhaarName,
                        similarity,
                        isMatch,
                        status,
                        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });
            }

            res.status(200).json({
                result: {
                    success: true,
                    similarity,
                    isMatch,
                    status,
                    message
                }
            });

        } catch (err: any) {
            log.error(`Error verifying names: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to verify names" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Submit Selfie for Manual Verification
// ============================================================
export const verifySelfieFaceMatch = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { selfieBase64, documentBase64, sellerId, livenessCompleted } = req.body;

            if (!selfieBase64 || !documentBase64) {
                res.status(400).json({ result: { success: false, message: "Both selfie and document images are required" } });
                return;
            }

            if (!sellerId) {
                res.status(400).json({ result: { success: false, message: "Seller ID is required" } });
                return;
            }

            log.info(`Submitting face verification for manual review - seller: ${sellerId}`);

            // Detect face in selfie to validate it's a proper face photo
            const [selfieResult] = await visionClient.faceDetection({ image: { content: selfieBase64 } });
            const selfieFaces = selfieResult.faceAnnotations || [];

            if (selfieFaces.length === 0) {
                res.status(200).json({
                    result: {
                        success: false,
                        confidence: 0,
                        isMatch: false,
                        message: "No face detected in selfie. Please retake with better lighting.",
                        code: "NO_FACE_IN_SELFIE"
                    }
                });
                return;
            }

            // Store images for manual verification
            const storage = admin.storage().bucket();
            const timestamp = Date.now();

            // Upload selfie
            const selfieBuffer = Buffer.from(selfieBase64, 'base64');
            const selfieFile = storage.file(`kyc/${sellerId}/selfie_${timestamp}.jpg`);
            await selfieFile.save(selfieBuffer, {
                contentType: 'image/jpeg',
                public: true,
                metadata: { cacheControl: 'public, max-age=31536000' }
            });
            const selfieUrl = `https://storage.googleapis.com/${storage.name}/kyc/${sellerId}/selfie_${timestamp}.jpg`;

            // Upload document photo
            const docBuffer = Buffer.from(documentBase64, 'base64');
            const docFile = storage.file(`kyc/${sellerId}/document_${timestamp}.jpg`);
            await docFile.save(docBuffer, {
                contentType: 'image/jpeg',
                public: true,
                metadata: { cacheControl: 'public, max-age=31536000' }
            });
            const docUrl = `https://storage.googleapis.com/${storage.name}/kyc/${sellerId}/document_${timestamp}.jpg`;

            // Store verification request for admin review
            await admin.firestore().collection("kyc_verifications").doc(sellerId).set({
                faceVerification: {
                    selfieUrl,
                    documentUrl: docUrl,
                    status: "pending_review",
                    livenessCompleted: livenessCompleted || false,
                    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                    reviewedAt: null,
                    reviewedBy: null,
                    isMatch: null,
                    notes: null
                }
            }, { merge: true });

            // Also update seller document
            await admin.firestore().collection("sellers").doc(sellerId).update({
                faceVerificationStatus: "pending_review",
                faceVerificationSubmittedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            log.success(`Face verification submitted for manual review - seller: ${sellerId}`);

            res.status(200).json({
                result: {
                    success: true,
                    status: "pending_review",
                    message: "Your selfie has been submitted for verification. Our team will review it within 24 hours."
                }
            });

        } catch (err: any) {
            log.error(`Error submitting face verification: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to submit for verification" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Submit Complete KYC Documents
// ============================================================
export const submitKycDocuments = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const {
                sellerId,
                sellerEmail,
                sellerName,
                panImageBase64,
                aadhaarFrontBase64,
                aadhaarBackBase64,
                selfieBase64,
                panNumber,
                panName,
                aadhaarNumber,
                aadhaarName,
                businessType,
                gstNumber,
                isGstExempt,
                bankDetails,
                businessAddress
            } = req.body;

            if (!sellerId) {
                res.status(400).json({ result: { success: false, message: "Seller ID is required" } });
                return;
            }

            log.info(`Submitting complete KYC for seller: ${sellerId}`);

            const storage = admin.storage().bucket();
            const timestamp = Date.now();
            const documentUrls: any = {};

            // ═══════════════════════════════════════════════════════════════
            // SECURE DOCUMENT UPLOADS (Private with Signed URLs)
            // ═══════════════════════════════════════════════════════════════

            // Upload PAN image (PRIVATE)
            if (panImageBase64) {
                const panBuffer = Buffer.from(panImageBase64, 'base64');
                const { gcsPath, signedUrl } = await uploadPrivateFile(
                    storage,
                    `kyc/${sellerId}/pan_${timestamp}.jpg`,
                    panBuffer,
                    'image/jpeg'
                );
                documentUrls.panImageUrl = signedUrl;
                documentUrls.panGcsPath = gcsPath;
                log.info(`Uploaded PAN securely for ${sellerId}`);
            }

            // Upload Aadhaar Front (PRIVATE)
            if (aadhaarFrontBase64) {
                const aadhaarFrontBuffer = Buffer.from(aadhaarFrontBase64, 'base64');
                const { gcsPath, signedUrl } = await uploadPrivateFile(
                    storage,
                    `kyc/${sellerId}/aadhaar_front_${timestamp}.jpg`,
                    aadhaarFrontBuffer,
                    'image/jpeg'
                );
                documentUrls.aadhaarFrontUrl = signedUrl;
                documentUrls.aadhaarFrontGcsPath = gcsPath;
                log.info(`Uploaded Aadhaar Front securely for ${sellerId}`);
            }

            // Upload Aadhaar Back (PRIVATE)
            if (aadhaarBackBase64) {
                const aadhaarBackBuffer = Buffer.from(aadhaarBackBase64, 'base64');
                const { gcsPath, signedUrl } = await uploadPrivateFile(
                    storage,
                    `kyc/${sellerId}/aadhaar_back_${timestamp}.jpg`,
                    aadhaarBackBuffer,
                    'image/jpeg'
                );
                documentUrls.aadhaarBackUrl = signedUrl;
                documentUrls.aadhaarBackGcsPath = gcsPath;
                log.info(`Uploaded Aadhaar Back securely for ${sellerId}`);
            }

            // Upload Selfie (PRIVATE)
            if (selfieBase64) {
                const selfieBuffer = Buffer.from(selfieBase64, 'base64');
                const { gcsPath, signedUrl } = await uploadPrivateFile(
                    storage,
                    `kyc/${sellerId}/selfie_${timestamp}.jpg`,
                    selfieBuffer,
                    'image/jpeg'
                );
                documentUrls.selfieUrl = signedUrl;
                documentUrls.selfieGcsPath = gcsPath;
                log.info(`Uploaded Selfie securely for ${sellerId}`);
            }

            // Upload Bank Proof (PRIVATE)
            if (bankDetails?.bankProofBase64) {
                const bankProofBuffer = Buffer.from(bankDetails.bankProofBase64, 'base64');
                const fileExtension = bankDetails.bankProofType === 'pdf' ? 'pdf' : 'jpg';
                const contentType = bankDetails.bankProofType === 'pdf' ? 'application/pdf' : 'image/jpeg';
                const { gcsPath, signedUrl } = await uploadPrivateFile(
                    storage,
                    `kyc/${sellerId}/bank_proof_${timestamp}.${fileExtension}`,
                    bankProofBuffer,
                    contentType
                );
                documentUrls.bankProofUrl = signedUrl;
                documentUrls.bankProofGcsPath = gcsPath;
                documentUrls.bankProofFileName = bankDetails.bankProofFileName || `bank_proof.${fileExtension}`;
                documentUrls.bankProofType = bankDetails.bankProofType || 'image';
                log.info(`Uploaded Bank Proof securely for ${sellerId}`);
            }

            // ═══════════════════════════════════════════════════════════════
            // STORE KYC SUBMISSION WITH HASHED SENSITIVE DATA
            // ═══════════════════════════════════════════════════════════════
            const kycData = {
                sellerId,
                sellerEmail: sellerEmail || null,
                sellerName: sellerName || null,
                status: "pending",
                documents: documentUrls, // Contains signed URLs (expire in 7 days)
                extractedData: {
                    // Original numbers for admin verification (encrypted at rest by Firestore)
                    panNumber: panNumber || null,
                    panNumberHashed: panNumber ? hashSensitiveData(panNumber) : null,
                    panNumberMasked: panNumber ? maskNumber(panNumber, 4) : null,
                    panName: panName || null,
                    aadhaarNumber: aadhaarNumber || null,
                    aadhaarNumberHashed: aadhaarNumber ? hashSensitiveData(aadhaarNumber.replace(/\s/g, '')) : null,
                    aadhaarNumberMasked: aadhaarNumber ? maskNumber(aadhaarNumber.replace(/\s/g, ''), 4) : null,
                    aadhaarName: aadhaarName || null
                },
                businessInfo: {
                    businessType: businessType || null,
                    gstNumber: gstNumber || null,
                    isGstExempt: isGstExempt || false
                },
                bankDetails: bankDetails || null,
                businessAddress: businessAddress || null,
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewedAt: null,
                reviewedBy: null,
                rejectionReason: null
            };

            await admin.firestore().collection("kyc_submissions").doc(sellerId).set(kycData);

            // Update seller document
            await admin.firestore().collection("sellers").doc(sellerId).update({
                kycStatus: "pending",
                kycSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
                panNumber: panNumber || null,
                panName: panName || null,
                aadhaarNumber: aadhaarNumber || null,
                aadhaarName: aadhaarName || null,
                businessType: businessType || null,
                gstNumber: gstNumber || null,
                verificationStatus: "pending"
            });

            // Create notification for seller
            await admin.firestore().collection("notifications").add({
                userId: sellerId,
                userType: "seller",
                type: "kyc_submitted",
                title: "KYC Submitted Successfully",
                body: "Your KYC documents have been submitted. Our team will review them within 24-48 hours.",
                icon: "verification",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Send email notification (if email provided)
            if (sellerEmail) {
                try {
                    const transporter = createEmailTransporter();

                    await transporter.sendMail({
                        from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                        to: sellerEmail,
                        subject: "KYC Documents Submitted - LetBuyy",
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR}, #0d3b2d); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">KYC Submitted Successfully</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Your KYC documents have been submitted successfully. Our verification team will review them within 24-48 hours.
                                    </p>
                                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="color: ${EMAIL_CONFIG.BRAND_COLOR}; margin-top: 0;">Submitted Documents:</h3>
                                        <ul style="color: #666;">
                                            <li>PAN Card</li>
                                            <li>Aadhaar Card (Front & Back)</li>
                                            <li>Selfie Verification</li>
                                            <li>Business Details</li>
                                        </ul>
                                    </div>
                                    <p style="font-size: 14px; color: #666;">
                                        You will receive an email notification once your KYC is verified.
                                    </p>
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `
                    });
                    log.info(`KYC submission email sent to ${sellerEmail}`);
                } catch (emailErr: any) {
                    log.warn(`Failed to send email: ${emailErr?.message}`);
                }
            }

            log.success(`KYC submitted successfully for ${sellerId}`);

            res.status(200).json({
                result: {
                    success: true,
                    message: "KYC documents submitted successfully. You will be notified once verified.",
                    documentUrls
                }
            });

        } catch (err: any) {
            log.error(`Error submitting KYC: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to submit KYC" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Admin - Review KYC (Approve/Reject)
// ============================================================
export const adminReviewKyc = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { sellerId, approved, rejectionReason, adminId, sendEmail = true, sendPush = true, adminNotes } = req.body;

            if (!sellerId || approved === undefined) {
                res.status(400).json({ result: { success: false, message: "Seller ID and approval status required" } });
                return;
            }

            log.info(`Admin reviewing KYC - seller: ${sellerId}, approved: ${approved}`);

            // Get seller info
            const sellerDoc = await admin.firestore().collection("sellers").doc(sellerId).get();
            const sellerData = sellerDoc.data();

            // Get KYC submission to extract bank details
            const kycSubmissionDoc = await admin.firestore().collection("kyc_submissions").doc(sellerId).get();
            const kycSubmissionData = kycSubmissionDoc.data();

            const newStatus = approved ? "verified" : "rejected";

            // Update KYC submission
            await admin.firestore().collection("kyc_submissions").doc(sellerId).update({
                status: newStatus,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewedBy: adminId || "admin",
                rejectionReason: approved ? null : (rejectionReason || "Documents could not be verified"),
                adminNotes: adminNotes || null
            });

            // Update seller document - include bank details if approved
            const sellerUpdateData: any = {
                kycStatus: newStatus,
                verificationStatus: newStatus,
                kycReviewedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // ✅ When approved, copy bank details and address to seller document
            if (approved && kycSubmissionData) {
                const bankDetails = kycSubmissionData.bankDetails;
                const businessAddress = kycSubmissionData.businessAddress;

                if (bankDetails) {
                    sellerUpdateData.bankAccountNumber = bankDetails.accountNumber || null;
                    sellerUpdateData.bankIfscCode = bankDetails.ifscCode || null;
                    sellerUpdateData.bankAccountHolderName = bankDetails.accountHolderName || null;
                    sellerUpdateData.bankName = bankDetails.bankName || null;
                    log.info(`Copying bank details to seller: ${sellerId}`);
                }

                if (businessAddress) {
                    sellerUpdateData.businessAddress = businessAddress;
                }
            }

            await admin.firestore().collection("sellers").doc(sellerId).update(sellerUpdateData);

            // Create notification
            await admin.firestore().collection("notifications").add({
                userId: sellerId,
                userType: "seller",
                type: approved ? "kyc_approved" : "kyc_rejected",
                title: approved ? "KYC Verified!" : "KYC Verification Failed",
                body: approved
                    ? "Congratulations! Your KYC has been verified. You can now start selling on LetBuyy."
                    : `Your KYC verification was rejected. Reason: ${rejectionReason || "Documents could not be verified"}`,
                icon: approved ? "verified" : "error",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Send email notification (if sendEmail is not explicitly false)
            if (sendEmail !== false && sellerData?.email) {
                try {
                    const transporter = createEmailTransporter();

                    const emailHtml = approved
                        ? `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR}, #0d3b2d); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">🎉 KYC Verified!</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerData.storeName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Great news! Your KYC verification has been approved. You can now start listing products and selling on ${EMAIL_CONFIG.APP_NAME}.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${EMAIL_CONFIG.APP_URL}" style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start Selling</a>
                                    </div>
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `
                        : `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #d32f2f, #b71c1c); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">KYC Verification Failed</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerData.storeName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Unfortunately, your KYC verification was not successful.
                                    </p>
                                    <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                                        <p style="color: #c62828; margin: 0;"><strong>Reason:</strong> ${rejectionReason || "Documents could not be verified"}</p>
                                    </div>
                                    <p style="font-size: 14px; color: #666;">
                                        Please login and re-submit your KYC with valid documents.
                                    </p>
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `;

                    await transporter.sendMail({
                        from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                        to: sellerData.email,
                        subject: approved ? "KYC Verified - LetBuyy" : "KYC Verification Failed - LetBuyy",
                        html: emailHtml
                    });
                    log.info(`KYC ${approved ? 'approval' : 'rejection'} email sent to ${sellerData.email}`);
                } catch (emailErr: any) {
                    log.warn(`Failed to send email: ${emailErr?.message}`);
                }
            }

            // Send push notification to all seller devices (if sendPush is not explicitly false)
            const fcmTokens = sellerData?.fcmTokens as string[] || [];
            // Also check for legacy single token
            if (sellerData?.fcmToken && !fcmTokens.includes(sellerData.fcmToken)) {
                fcmTokens.push(sellerData.fcmToken);
            }

            if (sendPush !== false && fcmTokens.length > 0) {
                const pushTitle = approved ? "KYC Verified! 🎉" : "KYC Verification Failed";
                const pushBody = approved
                    ? "Your KYC has been verified. Start selling now!"
                    : `Your KYC was rejected. Reason: ${rejectionReason || "Documents could not be verified"}`;

                let successCount = 0;
                let failedTokens: string[] = [];

                for (const token of fcmTokens) {
                    try {
                        await admin.messaging().send({
                            token,
                            notification: {
                                title: pushTitle,
                                body: pushBody
                            },
                            data: {
                                type: approved ? "kyc_approved" : "kyc_rejected",
                                sellerId,
                                click_action: "FLUTTER_NOTIFICATION_CLICK"
                            },
                            android: {
                                priority: "high",
                                notification: {
                                    channelId: "kyc_channel",
                                    icon: "ic_notification",
                                    color: approved ? "#4CAF50" : "#F44336",
                                    sound: "default"
                                }
                            },
                            apns: {
                                headers: { "apns-priority": "10" },
                                payload: {
                                    aps: {
                                        alert: { title: pushTitle, body: pushBody },
                                        sound: "default",
                                        badge: 1
                                    }
                                }
                            }
                        });
                        successCount++;
                        log.info(`Push notification sent to token: ${token.substring(0, 20)}...`);
                    } catch (pushErr: any) {
                        const errCode = pushErr?.code;
                        log.warn(`Failed to send push to token ${token.substring(0, 20)}...: ${errCode || pushErr?.message}`);

                        // Mark invalid tokens for removal
                        if (errCode === "messaging/invalid-registration-token" ||
                            errCode === "messaging/registration-token-not-registered") {
                            failedTokens.push(token);
                        }
                    }
                }

                log.info(`Push notifications sent: ${successCount}/${fcmTokens.length} successful`);

                // Remove invalid tokens from seller document
                if (failedTokens.length > 0) {
                    try {
                        await admin.firestore().collection("sellers").doc(sellerId).update({
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                        });
                        log.info(`Removed ${failedTokens.length} invalid FCM tokens from seller`);
                    } catch (cleanupErr: any) {
                        log.warn(`Failed to cleanup invalid tokens: ${cleanupErr?.message}`);
                    }
                }
            } else {
                log.warn(`No FCM tokens found for seller ${sellerId}`);
            }

            log.success(`KYC ${approved ? "approved" : "rejected"} for ${sellerId}`);

            res.status(200).json({
                result: {
                    success: true,
                    message: `KYC ${approved ? "approved" : "rejected"} successfully`
                }
            });

        } catch (err: any) {
            log.error(`Error reviewing KYC: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to review KYC" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Admin - Review Face Verification (Legacy)
// ============================================================
export const adminReviewFaceVerification = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const { sellerId, approved, notes, adminId } = req.body;

            if (!sellerId || approved === undefined) {
                res.status(400).json({ result: { success: false, message: "Seller ID and approval status required" } });
                return;
            }

            log.info(`Admin reviewing face verification - seller: ${sellerId}, approved: ${approved}`);

            // Update verification status
            await admin.firestore().collection("kyc_verifications").doc(sellerId).update({
                "faceVerification.status": approved ? "approved" : "rejected",
                "faceVerification.isMatch": approved,
                "faceVerification.reviewedAt": admin.firestore.FieldValue.serverTimestamp(),
                "faceVerification.reviewedBy": adminId || "admin",
                "faceVerification.notes": notes || null
            });

            // Update seller document
            await admin.firestore().collection("sellers").doc(sellerId).update({
                faceVerificationStatus: approved ? "verified" : "rejected",
                faceVerificationReviewedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            log.success(`Face verification ${approved ? "approved" : "rejected"} - seller: ${sellerId}`);

            res.status(200).json({
                result: {
                    success: true,
                    message: `Verification ${approved ? "approved" : "rejected"} successfully`
                }
            });

        } catch (err: any) {
            log.error(`Error reviewing verification: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to review verification" }
            });
        }
    });
});

// ============================================================
// CLOUD FUNCTION: Admin - Update Seller Status (Suspend/Reactivate)
// ============================================================
export const updateSellerStatus = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === "OPTIONS") {
                res.status(204).send("");
                return;
            }

            if (req.method !== "POST") {
                res.status(405).json({ result: { success: false, message: "Method not allowed" } });
                return;
            }

            const {
                sellerId,
                verificationStatus,
                isActive,
                adminId,
                adminNotes,
                sendEmail = true,
                sendPush = true
            } = req.body;

            if (!sellerId) {
                res.status(400).json({ result: { success: false, message: "Seller ID required" } });
                return;
            }

            log.info(`Admin updating seller status - seller: ${sellerId}, isActive: ${isActive}, verificationStatus: ${verificationStatus}`);

            // Get seller info
            const sellerDoc = await admin.firestore().collection("sellers").doc(sellerId).get();
            const sellerData = sellerDoc.data();

            if (!sellerData) {
                res.status(404).json({ result: { success: false, message: "Seller not found" } });
                return;
            }

            const previousStatus = sellerData.verificationStatus;
            const wasActive = sellerData.isActive;

            // Update seller document
            const updateData: any = {};
            if (verificationStatus !== undefined) {
                updateData.verificationStatus = verificationStatus;
            }
            if (isActive !== undefined) {
                updateData.isActive = isActive;
            }
            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.updatedBy = adminId || "admin";
            if (adminNotes) {
                updateData.adminNotes = adminNotes;
            }

            await admin.firestore().collection("sellers").doc(sellerId).update(updateData);

            // Determine what changed
            const statusChanged = verificationStatus !== undefined && verificationStatus !== previousStatus;
            const activeChanged = isActive !== undefined && isActive !== wasActive;
            const wasSuspended = activeChanged && isActive === false;
            const wasReactivated = activeChanged && isActive === true && wasActive === false;

            // Create notification
            let notificationType = "status_updated";
            let notificationTitle = "Account Updated";
            let notificationBody = "Your account status has been updated.";
            let notificationIcon = "info";

            if (wasSuspended) {
                notificationType = "account_suspended";
                notificationTitle = "Account Suspended";
                notificationBody = "Your seller account has been suspended. Please contact support for more information.";
                notificationIcon = "warning";
            } else if (wasReactivated) {
                notificationType = "account_reactivated";
                notificationTitle = "Account Reactivated! 🎉";
                notificationBody = "Your seller account has been reactivated. You can now continue selling on LetBuyy!";
                notificationIcon = "success";
            } else if (statusChanged) {
                notificationTitle = "Verification Status Updated";
                notificationBody = `Your verification status has been changed to: ${verificationStatus}`;
            }

            await admin.firestore().collection("notifications").add({
                userId: sellerId,
                userType: "seller",
                type: notificationType,
                title: notificationTitle,
                body: notificationBody,
                icon: notificationIcon,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Send email notification
            if (sendEmail !== false && sellerData?.email) {
                try {
                    const transporter = createEmailTransporter();

                    let emailSubject = "Account Status Updated - LetBuyy";
                    let emailHtml = "";

                    if (wasSuspended) {
                        emailSubject = "Account Suspended - LetBuyy";
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #d32f2f, #b71c1c); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">⚠️ Account Suspended</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerData.storeName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Your seller account on ${EMAIL_CONFIG.APP_NAME} has been suspended by our admin team.
                                    </p>
                                    ${adminNotes ? `
                                    <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                                        <p style="color: #c62828; margin: 0;"><strong>Reason:</strong> ${adminNotes}</p>
                                    </div>
                                    ` : ''}
                                    <p style="font-size: 14px; color: #666;">
                                        If you believe this is an error, please contact our support team for assistance.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}" style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Contact Support</a>
                                    </div>
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `;
                    } else if (wasReactivated) {
                        emailSubject = "Account Reactivated! - LetBuyy";
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR}, #0d3b2d); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">🎉 Account Reactivated!</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerData.storeName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Great news! Your seller account on ${EMAIL_CONFIG.APP_NAME} has been reactivated.
                                    </p>
                                    <p style="font-size: 14px; color: #666;">
                                        You can now log in and continue selling your products on our platform.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${EMAIL_CONFIG.APP_URL}" style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start Selling</a>
                                    </div>
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `;
                    } else {
                        emailSubject = "Account Status Updated - LetBuyy";
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, ${EMAIL_CONFIG.BRAND_COLOR}, #0d3b2d); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">Account Updated</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <p style="font-size: 16px; color: #333;">Hello ${sellerData.storeName || 'Seller'},</p>
                                    <p style="font-size: 14px; color: #666;">
                                        Your account on ${EMAIL_CONFIG.APP_NAME} has been updated by our admin team.
                                    </p>
                                    ${statusChanged ? `<p style="font-size: 14px; color: #666;">New verification status: <strong>${verificationStatus}</strong></p>` : ''}
                                    ${adminNotes ? `<p style="font-size: 14px; color: #666;">Admin notes: ${adminNotes}</p>` : ''}
                                </div>
                                <div style="background: #333; padding: 20px; text-align: center;">
                                    <p style="color: #999; font-size: 12px; margin: 0;">© 2024 ${EMAIL_CONFIG.APP_NAME}. All rights reserved.</p>
                                </div>
                            </div>
                        `;
                    }

                    await transporter.sendMail({
                        from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                        to: sellerData.email,
                        subject: emailSubject,
                        html: emailHtml
                    });
                    log.info(`Status update email sent to ${sellerData.email}`);
                } catch (emailErr: any) {
                    log.warn(`Failed to send email: ${emailErr?.message}`);
                }
            }

            // Send push notification
            const fcmTokens = sellerData?.fcmTokens as string[] || [];
            if (sellerData?.fcmToken && !fcmTokens.includes(sellerData.fcmToken)) {
                fcmTokens.push(sellerData.fcmToken);
            }

            if (sendPush !== false && fcmTokens.length > 0) {
                let successCount = 0;
                let failedTokens: string[] = [];

                for (const token of fcmTokens) {
                    try {
                        await admin.messaging().send({
                            token,
                            notification: {
                                title: notificationTitle,
                                body: notificationBody
                            },
                            data: {
                                type: notificationType,
                                sellerId,
                                click_action: "FLUTTER_NOTIFICATION_CLICK"
                            },
                            android: {
                                priority: "high",
                                notification: {
                                    channelId: wasSuspended ? "alert_channel" : "general_channel",
                                    icon: "ic_notification",
                                    color: wasSuspended ? "#F44336" : "#4CAF50",
                                    sound: "default"
                                }
                            },
                            apns: {
                                headers: { "apns-priority": "10" },
                                payload: {
                                    aps: {
                                        alert: { title: notificationTitle, body: notificationBody },
                                        sound: "default",
                                        badge: 1
                                    }
                                }
                            }
                        });
                        successCount++;
                        log.info(`Push notification sent to token: ${token.substring(0, 20)}...`);
                    } catch (pushErr: any) {
                        const errCode = pushErr?.code;
                        log.warn(`Failed to send push: ${errCode || pushErr?.message}`);
                        if (errCode === "messaging/invalid-registration-token" ||
                            errCode === "messaging/registration-token-not-registered") {
                            failedTokens.push(token);
                        }
                    }
                }

                log.info(`Push notifications sent: ${successCount}/${fcmTokens.length} successful`);

                // Remove invalid tokens
                if (failedTokens.length > 0) {
                    try {
                        await admin.firestore().collection("sellers").doc(sellerId).update({
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                        });
                    } catch (cleanupErr: any) {
                        log.warn(`Failed to cleanup invalid tokens: ${cleanupErr?.message}`);
                    }
                }
            }

            log.success(`Seller status updated for ${sellerId}`);

            res.status(200).json({
                result: {
                    success: true,
                    message: "Seller status updated successfully"
                }
            });

        } catch (err: any) {
            log.error(`Error updating seller status: ${err?.message || err}`);
            res.status(500).json({
                result: { success: false, message: err?.message || "Failed to update seller status" }
            });
        }
    });
});

// Export info log
console.log("\n✅ [KYCVerification] ✅ KYC Verification functions loaded\n");
