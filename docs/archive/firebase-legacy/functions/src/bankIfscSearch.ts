// functions/src/bankIfscSearch.ts
// Cloud Function to search IFSC codes by bank, state, and district

import * as functions from "firebase-functions";
import cors from "cors";

const corsHandler = cors({ origin: true });

// This function fetches IFSC data from RazorPay's GitHub repository
// The data is structured as: https://github.com/razorpay/ifsc/tree/master/src/data
// We'll use their CDN endpoint for individual lookups

interface IfscBranch {
    BANK: string;
    IFSC: string;
    BRANCH: string;
    CENTRE: string;
    DISTRICT: string;
    STATE: string;
    ADDRESS: string;
    CONTACT: string;
    CITY: string;
    MICR: string;
}

// Search IFSC codes by bank code, state, and district
export const searchIfscCodes = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { bankCode, state, district } = req.body;

            if (!bankCode || !state || !district) {
                res.status(400).json({
                    success: false,
                    error: "bankCode, state, and district are required",
                });
                return;
            }

            const results: IfscBranch[] = [];
            const testedCodes: string[] = [];

            // Generate IFSC patterns to try (bank code + 0 + 6 digit branch code)
            // We'll try first 500 patterns to find matches
            for (let i = 1; i <= 500; i++) {
                const ifsc = `${bankCode.toUpperCase()}0${i.toString().padStart(6, "0")}`;
                testedCodes.push(ifsc);
            }

            // Fetch in parallel batches of 50
            const batchSize = 50;
            for (let batch = 0; batch < testedCodes.length; batch += batchSize) {
                const batchCodes = testedCodes.slice(batch, batch + batchSize);

                const batchResults = await Promise.allSettled(
                    batchCodes.map(async (ifsc) => {
                        try {
                            const response = await fetch(
                                `https://ifsc.razorpay.com/${ifsc}`
                            );
                            if (response.ok) {
                                return await response.json();
                            }
                            return null;
                        } catch {
                            return null;
                        }
                    })
                );

                for (const result of batchResults) {
                    if (result.status === "fulfilled" && result.value) {
                        const data = result.value as IfscBranch;
                        // Filter by state and district
                        if (
                            data.STATE?.toUpperCase() === state.toUpperCase() &&
                            data.DISTRICT?.toUpperCase() === district.toUpperCase()
                        ) {
                            results.push(data);
                        }
                    }
                }

                // If we found enough results, stop
                if (results.length >= 50) break;
            }

            res.status(200).json({
                success: true,
                count: results.length,
                branches: results,
            });
        } catch (error) {
            console.error("IFSC search error:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error",
            });
        }
    });
});

// Get districts for a state (from a predefined list)
export const getDistrictsByState = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { state } = req.body;

            if (!state) {
                res.status(400).json({
                    success: false,
                    error: "state is required",
                });
                return;
            }

            // Return districts for the state
            const districts = indianDistricts[state.toUpperCase()] || [];

            res.status(200).json({
                success: true,
                state: state,
                districts: districts,
            });
        } catch (error) {
            console.error("Get districts error:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error",
            });
        }
    });
});

// Indian districts by state (major districts only for performance)
const indianDistricts: Record<string, string[]> = {
    "TAMIL NADU": [
        "CHENNAI", "COIMBATORE", "MADURAI", "TIRUCHIRAPPALLI", "SALEM",
        "TIRUNELVELI", "TIRUPUR", "ERODE", "VELLORE", "THOOTHUKUDI",
        "THANJAVUR", "DINDIGUL", "KANCHIPURAM", "CUDDALORE", "VILLUPURAM",
        "NAGAPATTINAM", "KARUR", "NAMAKKAL", "KRISHNAGIRI", "DHARMAPURI",
        "SIVAGANGA", "VIRUDHUNAGAR", "RAMANATHAPURAM", "THENI", "PUDUKKOTTAI",
        "NILGIRIS", "KANYAKUMARI", "PERAMBALUR", "ARIYALUR", "TIRUVARUR",
    ],
    "KARNATAKA": [
        "BENGALURU URBAN", "BENGALURU RURAL", "MYSURU", "MANGALURU", "HUBLI",
        "BELGAUM", "GULBARGA", "DAVANAGERE", "BELLARY", "SHIMOGA",
        "TUMKUR", "RAICHUR", "BIDAR", "HASSAN", "MANDYA",
        "CHIKMAGALUR", "CHITRADURGA", "KODAGU", "UDUPI", "DHARWAD",
    ],
    "KERALA": [
        "THIRUVANANTHAPURAM", "KOCHI", "KOZHIKODE", "THRISSUR", "KOLLAM",
        "KANNUR", "ALAPPUZHA", "KOTTAYAM", "PALAKKAD", "MALAPPURAM",
        "IDUKKI", "PATHANAMTHITTA", "WAYANAD", "KASARAGOD",
    ],
    "ANDHRA PRADESH": [
        "VISAKHAPATNAM", "VIJAYAWADA", "GUNTUR", "NELLORE", "KURNOOL",
        "TIRUPATI", "KAKINADA", "RAJAHMUNDRY", "KADAPA", "ANANTAPUR",
        "ONGOLE", "ELURU", "CHITTOOR", "SRIKAKULAM", "VIZIANAGARAM",
    ],
    "TELANGANA": [
        "HYDERABAD", "WARANGAL", "NIZAMABAD", "KARIMNAGAR", "KHAMMAM",
        "MAHBUBNAGAR", "NALGONDA", "ADILABAD", "MEDAK", "RANGAREDDY",
    ],
    "MAHARASHTRA": [
        "MUMBAI", "PUNE", "NAGPUR", "THANE", "NASHIK",
        "AURANGABAD", "SOLAPUR", "KOLHAPUR", "SANGLI", "SATARA",
        "AHMEDNAGAR", "JALGAON", "DHULE", "NANDED", "LATUR",
        "RATNAGIRI", "SINDHUDURG", "RAIGAD", "PALGHAR", "BHANDARA",
    ],
    "GUJARAT": [
        "AHMEDABAD", "SURAT", "VADODARA", "RAJKOT", "BHAVNAGAR",
        "JAMNAGAR", "JUNAGADH", "GANDHINAGAR", "ANAND", "MEHSANA",
        "BHARUCH", "VALSAD", "NAVSARI", "KUTCH", "PATAN",
    ],
    "RAJASTHAN": [
        "JAIPUR", "JODHPUR", "UDAIPUR", "KOTA", "BIKANER",
        "AJMER", "ALWAR", "BHARATPUR", "SIKAR", "BHILWARA",
        "PALI", "NAGAUR", "TONK", "CHITTORGARH", "DUNGARPUR",
    ],
    "UTTAR PRADESH": [
        "LUCKNOW", "KANPUR", "AGRA", "VARANASI", "ALLAHABAD",
        "MEERUT", "GHAZIABAD", "NOIDA", "BAREILLY", "ALIGARH",
        "MORADABAD", "SAHARANPUR", "GORAKHPUR", "FAIZABAD", "JHANSI",
        "MATHURA", "FIROZABAD", "MUZAFFARNAGAR", "ETAWAH", "RAMPUR",
    ],
    "MADHYA PRADESH": [
        "BHOPAL", "INDORE", "JABALPUR", "GWALIOR", "UJJAIN",
        "SAGAR", "DEWAS", "SATNA", "RATLAM", "REWA",
        "MURWARA", "SINGRAULI", "BURHANPUR", "KHANDWA", "BHIND",
    ],
    "WEST BENGAL": [
        "KOLKATA", "HOWRAH", "DURGAPUR", "ASANSOL", "SILIGURI",
        "BARDHAMAN", "MALDA", "BAHARAMPUR", "HABRA", "KHARAGPUR",
        "DARJEELING", "JALPAIGURI", "COOCH BEHAR", "PURULIA", "BANKURA",
    ],
    "BIHAR": [
        "PATNA", "GAYA", "BHAGALPUR", "MUZAFFARPUR", "DARBHANGA",
        "PURNIA", "ARRAH", "BEGUSARAI", "KATIHAR", "MUNGER",
        "CHHAPRA", "BETTIAH", "SAHARSA", "SASARAM", "HAJIPUR",
    ],
    "ODISHA": [
        "BHUBANESWAR", "CUTTACK", "ROURKELA", "BERHAMPUR", "SAMBALPUR",
        "PURI", "BALASORE", "BRAHMAPUR", "BARIPADA", "JHARSUGUDA",
    ],
    "PUNJAB": [
        "LUDHIANA", "AMRITSAR", "JALANDHAR", "PATIALA", "BATHINDA",
        "MOHALI", "PATHANKOT", "HOSHIARPUR", "MOGA", "FIROZPUR",
    ],
    "HARYANA": [
        "FARIDABAD", "GURGAON", "PANIPAT", "AMBALA", "YAMUNANAGAR",
        "ROHTAK", "HISAR", "KARNAL", "SONIPAT", "PANCHKULA",
    ],
    "DELHI": [
        "CENTRAL DELHI", "EAST DELHI", "NEW DELHI", "NORTH DELHI",
        "NORTH EAST DELHI", "NORTH WEST DELHI", "SOUTH DELHI",
        "SOUTH EAST DELHI", "SOUTH WEST DELHI", "WEST DELHI",
    ],
    "JHARKHAND": [
        "RANCHI", "JAMSHEDPUR", "DHANBAD", "BOKARO", "HAZARIBAGH",
        "DEOGHAR", "GIRIDIH", "RAMGARH", "DUMKA", "CHAIBASA",
    ],
    "CHHATTISGARH": [
        "RAIPUR", "BHILAI", "BILASPUR", "KORBA", "DURG",
        "RAJNANDGAON", "RAIGARH", "JAGDALPUR", "AMBIKAPUR", "DHAMTARI",
    ],
    "ASSAM": [
        "GUWAHATI", "SILCHAR", "DIBRUGARH", "JORHAT", "NAGAON",
        "TINSUKIA", "TEZPUR", "BONGAIGAON", "DHUBRI", "DIPHU",
    ],
    "UTTARAKHAND": [
        "DEHRADUN", "HARIDWAR", "ROORKEE", "HALDWANI", "RUDRAPUR",
        "KASHIPUR", "RISHIKESH", "NAINITAL", "ALMORA", "PITHORAGARH",
    ],
    "HIMACHAL PRADESH": [
        "SHIMLA", "MANDI", "SOLAN", "DHARAMSHALA", "PALAMPUR",
        "BADDI", "NAHAN", "UNA", "KULLU", "BILASPUR",
    ],
    "GOA": [
        "NORTH GOA", "SOUTH GOA", "PANAJI", "MARGAO", "VASCO",
    ],
    "CHANDIGARH": [
        "CHANDIGARH",
    ],
    "PUDUCHERRY": [
        "PUDUCHERRY", "KARAIKAL", "MAHE", "YANAM",
    ],
};
