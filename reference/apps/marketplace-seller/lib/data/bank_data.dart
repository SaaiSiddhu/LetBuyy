// lib/data/bank_data.dart
// Bank data for KYC verification with account number lengths

class BankInfo {
  final String name;
  final String code; // IFSC prefix (first 4 chars)
  final int accountLength;
  final String? logoAsset;

  const BankInfo({
    required this.name,
    required this.code,
    required this.accountLength,
    this.logoAsset,
  });

  @override
  String toString() => name;
}

/// List of major Indian banks with their IFSC codes and account number lengths
const List<BankInfo> indianBanks = [
  // Public Sector Banks
  BankInfo(name: 'State Bank of India', code: 'SBIN', accountLength: 11),
  BankInfo(name: 'Punjab National Bank', code: 'PUNB', accountLength: 16),
  BankInfo(name: 'Bank of Baroda', code: 'BARB', accountLength: 14),
  BankInfo(name: 'Canara Bank', code: 'CNRB', accountLength: 13),
  BankInfo(name: 'Union Bank of India', code: 'UBIN', accountLength: 14),
  BankInfo(name: 'Bank of India', code: 'BKID', accountLength: 15),
  BankInfo(name: 'Indian Bank', code: 'IDIB', accountLength: 15),
  BankInfo(name: 'Central Bank of India', code: 'CBIN', accountLength: 15),
  BankInfo(name: 'Indian Overseas Bank', code: 'IOBA', accountLength: 15),
  BankInfo(name: 'UCO Bank', code: 'UCBA', accountLength: 14),
  BankInfo(name: 'Punjab & Sind Bank', code: 'PSIB', accountLength: 14),
  
  // Private Sector Banks
  BankInfo(name: 'HDFC Bank', code: 'HDFC', accountLength: 14),
  BankInfo(name: 'ICICI Bank', code: 'ICIC', accountLength: 12),
  BankInfo(name: 'Axis Bank', code: 'UTIB', accountLength: 15),
  BankInfo(name: 'Kotak Mahindra Bank', code: 'KKBK', accountLength: 14),
  BankInfo(name: 'IndusInd Bank', code: 'INDB', accountLength: 10),
  BankInfo(name: 'Yes Bank', code: 'YESB', accountLength: 15),
  BankInfo(name: 'IDFC First Bank', code: 'IDFB', accountLength: 14),
  BankInfo(name: 'Federal Bank', code: 'FDRL', accountLength: 14),
  BankInfo(name: 'South Indian Bank', code: 'SIBL', accountLength: 14),
  BankInfo(name: 'RBL Bank', code: 'RATN', accountLength: 12),
  BankInfo(name: 'Bandhan Bank', code: 'BDBL', accountLength: 11),
  BankInfo(name: 'Karnataka Bank', code: 'KARB', accountLength: 16),
  
  // Payment Banks & Small Finance Banks
  BankInfo(name: 'Paytm Payments Bank', code: 'PYTM', accountLength: 16),
  BankInfo(name: 'Airtel Payments Bank', code: 'AIRP', accountLength: 12),
  BankInfo(name: 'AU Small Finance Bank', code: 'AUBL', accountLength: 19),
  BankInfo(name: 'Equitas Small Finance Bank', code: 'ESFB', accountLength: 15),
  BankInfo(name: 'Ujjivan Small Finance Bank', code: 'UJVN', accountLength: 14),
];

/// Get bank info by IFSC code prefix
BankInfo? getBankByIfscPrefix(String ifsc) {
  if (ifsc.length < 4) return null;
  final prefix = ifsc.substring(0, 4).toUpperCase();
  try {
    return indianBanks.firstWhere((bank) => bank.code == prefix);
  } catch (_) {
    return null;
  }
}

/// Validate account number length for a specific bank
bool validateAccountNumber(BankInfo bank, String accountNumber) {
  // Remove spaces and special chars
  final cleaned = accountNumber.replaceAll(RegExp(r'[^0-9]'), '');
  return cleaned.length == bank.accountLength;
}
