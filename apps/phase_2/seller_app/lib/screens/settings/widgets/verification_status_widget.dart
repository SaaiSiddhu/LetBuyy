// lib/screens/seller/settings/widgets/verification_status_widget.dart
// ✅ PREMIUM VERIFICATION STATUS WIDGET
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

class VerificationStatusWidget extends StatelessWidget {
  final VerificationStatus status;
  final String? rejectionReason;
  final bool isDark;
  final VoidCallback? onTap;

  const VerificationStatusWidget({
    super.key,
    required this.status,
    this.rejectionReason,
    required this.isDark,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  _getStatusColor().withValues(alpha: 0.15),
                  _getStatusColor().withValues(alpha: 0.05),
                ],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _getStatusColor().withValues(alpha: 0.3),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: _getStatusColor().withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                // Main Status Card
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      // Animated Status Icon
                      _buildStatusIcon(),
                      const SizedBox(width: 16),
                      // Status Content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _getStatusTitle(),
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? Colors.white : Colors.black87,
                                    ),
                                  ),
                                ),
                                _buildStatusBadge(),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _getStatusDescription(),
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.white70 : Colors.black54,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Arrow
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: _getStatusColor().withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 14,
                          color: _getStatusColor(),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Progress Section (for pending)
                if (status == VerificationStatus.pending) _buildPendingProgress(),
                
                // Rejection Details
                if (status == VerificationStatus.rejected && rejectionReason != null)
                  _buildRejectionDetails(context),
                
                // Verified Benefits
                if (status == VerificationStatus.verified) _buildVerifiedBenefits(),
                
                // Suspended Warning
                if (status == VerificationStatus.suspended) _buildSuspendedWarning(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIcon() {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _getStatusColor(),
            _getStatusColor().withValues(alpha: 0.7),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: _getStatusColor().withValues(alpha: 0.4),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(
        _getStatusIcon(),
        color: Colors.white,
        size: 28,
      ),
    ).animate(
      onPlay: (controller) => status == VerificationStatus.pending
          ? controller.repeat(reverse: true)
          : null,
    ).scale(
      duration: 1500.ms,
      begin: const Offset(1, 1),
      end: status == VerificationStatus.pending 
          ? const Offset(1.05, 1.05) 
          : const Offset(1, 1),
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            _getStatusColor(),
            _getStatusColor().withValues(alpha: 0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _getStatusColor().withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status == VerificationStatus.verified
                ? Icons.verified_rounded
                : status == VerificationStatus.pending
                    ? Icons.schedule_rounded
                    : Icons.error_outline_rounded,
            color: Colors.white,
            size: 12,
          ),
          const SizedBox(width: 4),
          Text(
            _getStatusBadgeText(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPendingProgress() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        children: [
          // Checklist
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.fact_check_rounded,
                      size: 16,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Documents Under Review',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildChecklistItem('PAN Card', true),
                _buildChecklistItem('Aadhar Card', true),
                _buildChecklistItem('Live Selfie', true),
                _buildChecklistItem('Business Details', true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              backgroundColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation<Color>(_getStatusColor()),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.access_time_rounded,
                size: 14,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
              const SizedBox(width: 6),
              Text(
                'Estimated: 24-48 hours',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.white54 : Colors.black45,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistItem(String text, bool isCompleted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check_rounded,
              size: 12,
              color: AppColors.success,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white70 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRejectionDetails(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 18, color: AppColors.error),
              const SizedBox(width: 8),
              Text(
                'Rejection Reason',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppColors.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            rejectionReason!,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white70 : Colors.black54,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerifiedBenefits() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.success.withValues(alpha: 0.1),
            Colors.green.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.verified_user_rounded, color: AppColors.success, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Full Access Unlocked',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'All seller features are now available',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.check_circle_rounded,
            color: AppColors.success,
            size: 24,
          ),
        ],
      ),
    );
  }

  Widget _buildSuspendedWarning(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(Icons.block_rounded, size: 18, color: AppColors.error),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Account access is temporarily restricted',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                // Contact support
              },
              icon: const Icon(Icons.support_agent_rounded, size: 16),
              label: const Text('Contact Support'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor() {
    switch (status) {
      case VerificationStatus.verified:
        return AppColors.success;
      case VerificationStatus.pending:
        return const Color(0xFFF59E0B); // Amber
      case VerificationStatus.rejected:
        return AppColors.error;
      case VerificationStatus.suspended:
        return AppColors.error;
    }
  }

  IconData _getStatusIcon() {
    switch (status) {
      case VerificationStatus.verified:
        return Icons.verified_rounded;
      case VerificationStatus.pending:
        return Icons.hourglass_top_rounded;
      case VerificationStatus.rejected:
        return Icons.gpp_bad_rounded;
      case VerificationStatus.suspended:
        return Icons.block_rounded;
    }
  }

  String _getStatusTitle() {
    switch (status) {
      case VerificationStatus.verified:
        return 'KYC Verified';
      case VerificationStatus.pending:
        return 'Verification In Progress';
      case VerificationStatus.rejected:
        return 'Verification Failed';
      case VerificationStatus.suspended:
        return 'Account Suspended';
    }
  }

  String _getStatusBadgeText() {
    switch (status) {
      case VerificationStatus.verified:
        return 'ACTIVE';
      case VerificationStatus.pending:
        return 'PENDING';
      case VerificationStatus.rejected:
        return 'ACTION REQUIRED';
      case VerificationStatus.suspended:
        return 'SUSPENDED';
    }
  }

  String _getStatusDescription() {
    switch (status) {
      case VerificationStatus.verified:
        return 'Your identity has been verified. You have full access to all seller features.';
      case VerificationStatus.pending:
        return 'Your documents are being reviewed by our verification team.';
      case VerificationStatus.rejected:
        return 'Please review the reason and resubmit your documents.';
      case VerificationStatus.suspended:
        return 'Your account has been temporarily suspended. Contact support for help.';
    }
  }
}
