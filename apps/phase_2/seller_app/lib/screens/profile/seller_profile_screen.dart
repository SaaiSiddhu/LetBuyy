// lib/screens/profile/seller_profile_screen.dart
// Seller Profile Screen with account management

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import '../../providers/seller_provider.dart';
import '../../app/routes.dart';
import 'widgets/edit_profile_sheet.dart';

class SellerProfileScreen extends StatelessWidget {
  const SellerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
      ),
      body: Consumer<SellerProvider>(
        builder: (context, sellerProvider, child) {
          final seller = sellerProvider.currentSeller;
          
          return SingleChildScrollView(
            child: Column(
              children: [
                // Profile Header
                _buildProfileHeader(context, seller),
                const SizedBox(height: 24),
                
                // KYC Status Section
                _buildKycStatusSection(context, seller?.verificationStatus),
                const SizedBox(height: 16),
                
                // Business Info Section
                _buildSection(
                  context,
                  title: 'Business Information',
                  items: [
                    _ProfileItem(
                      icon: Icons.store_outlined,
                      title: 'Business Name',
                      subtitle: seller?.storeName ?? seller?.businessLegalName ?? 'Not set',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.category_outlined,
                      title: 'Business Type',
                      subtitle: seller?.businessType ?? 'Not set',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.receipt_long_outlined,
                      title: 'GST Number',
                      subtitle: seller?.gstNumber ?? 'Not provided',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Account Section
                _buildSection(
                  context,
                  title: 'Account',
                  items: [
                    _ProfileItem(
                      icon: Icons.email_outlined,
                      title: 'Email',
                      subtitle: seller?.email ?? 'Not set',
                      showVerified: seller?.verificationStatus == VerificationStatus.verified,
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.phone_outlined,
                      title: 'Phone',
                      subtitle: seller?.phone ?? 'Not set',
                      showVerified: true,
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.lock_outline,
                      title: 'Change Password',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Bank Details Section
                _buildSection(
                  context,
                  title: 'Bank Details',
                  items: [
                    _ProfileItem(
                      icon: Icons.account_balance_outlined,
                      title: 'Bank Account',
                      subtitle: seller?.bankAccountNumber != null 
                          ? '••••${seller!.bankAccountNumber!.substring(seller.bankAccountNumber!.length - 4)}'
                          : 'Not linked',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.credit_card_outlined,
                      title: 'IFSC Code',
                      subtitle: seller?.bankIfscCode ?? 'Not set',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Settings Section
                _buildSection(
                  context,
                  title: 'Settings',
                  items: [
                    _ProfileItem(
                      icon: Icons.notifications_outlined,
                      title: 'Notifications',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.help_outline,
                      title: 'Help & Support',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.description_outlined,
                      title: 'Terms & Conditions',
                      onTap: () {},
                    ),
                    _ProfileItem(
                      icon: Icons.privacy_tip_outlined,
                      title: 'Privacy Policy',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                
                // Logout Button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _showLogoutDialog(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.logout),
                      label: const Text('Logout'),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context, dynamic seller) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.primary.withValues(alpha: 0.1),
            AppColors.background,
          ],
        ),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () => _openEditProfile(context, seller),
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 50,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                  backgroundImage: seller?.photoUrl != null
                      ? NetworkImage(seller.photoUrl!)
                      : null,
                  child: seller?.photoUrl == null
                      ? Icon(Icons.person, size: 50, color: AppColors.primary)
                      : null,
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(Icons.edit, size: 16, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            seller?.name ?? 'Seller',
            style: AppTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            seller?.email ?? '',
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          // Edit Profile Button
          OutlinedButton.icon(
            onPressed: () => _openEditProfile(context, seller),
            icon: const Icon(Icons.edit, size: 18),
            label: const Text('Edit Profile'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: BorderSide(color: AppColors.primary),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }

  void _openEditProfile(BuildContext context, dynamic seller) async {
    HapticFeedback.lightImpact();
    final sellerId = FirebaseAuth.instance.currentUser?.uid;
    if (sellerId == null) return;

    // Get current seller data from Firestore
    final doc = await FirebaseFirestore.instance
        .collection('sellers')
        .doc(sellerId)
        .get();
    
    final currentData = doc.data() ?? {};
    
    if (context.mounted) {
      EditProfileSheet.show(
        context,
        currentData: currentData,
        sellerId: sellerId,
      );
    }
  }

  Widget _buildKycStatusSection(BuildContext context, VerificationStatus? status) {
    Color bgColor;
    Color textColor;
    IconData icon;
    String statusText;
    String message;

    switch (status) {
      case VerificationStatus.verified:
        bgColor = AppColors.success.withValues(alpha: 0.1);
        textColor = AppColors.success;
        icon = Icons.verified;
        statusText = 'Verified';
        message = 'Your account is fully verified';
        break;
      case VerificationStatus.pending:
        bgColor = Colors.orange.withValues(alpha: 0.1);
        textColor = Colors.orange;
        icon = Icons.schedule;
        statusText = 'Under Review';
        message = 'KYC verification in progress';
        break;
      case VerificationStatus.rejected:
        bgColor = AppColors.error.withValues(alpha: 0.1);
        textColor = AppColors.error;
        icon = Icons.error_outline;
        statusText = 'Rejected';
        message = 'Please resubmit your documents';
        break;
      default:
        bgColor = AppColors.primary.withValues(alpha: 0.1);
        textColor = AppColors.primary;
        icon = Icons.assignment_outlined;
        statusText = 'Pending';
        message = 'Complete your KYC verification';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: textColor.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: textColor.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: textColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'KYC Status: ',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Text(
                        statusText,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: textColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    message,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (status != VerificationStatus.verified)
              Icon(Icons.chevron_right, color: textColor),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(
    BuildContext context, {
    required String title,
    required List<_ProfileItem> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            title,
            style: AppTextStyles.titleSmall.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Column(
                children: [
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(item.icon, color: AppColors.primary, size: 20),
                    ),
                    title: Text(item.title, style: AppTextStyles.bodyMedium),
                    subtitle: item.subtitle != null
                        ? Row(
                            children: [
                              Text(
                                item.subtitle!,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              if (item.showVerified) ...[
                                const SizedBox(width: 8),
                                Icon(
                                  Icons.verified,
                                  size: 14,
                                  color: AppColors.success,
                                ),
                              ],
                            ],
                          )
                        : null,
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: item.onTap,
                  ),
                  if (index < items.length - 1)
                    Divider(height: 1, indent: 56, endIndent: 16),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              // Close dialog first
              Navigator.pop(dialogContext);
              
              // Capture navigator before async
              final navigator = Navigator.of(context);
              
              try {
                // Use SellerProvider for logout
                await context.read<SellerProvider>().signOut();
              } catch (e) {
                debugPrint('Logout error: $e');
              }
              
              // Navigate to login and clear stack
              navigator.pushNamedAndRemoveUntil(
                AppRoutes.login,
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

class _ProfileItem {
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool showVerified;
  final VoidCallback? onTap;

  _ProfileItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.showVerified = false,
    this.onTap,
  });
}
