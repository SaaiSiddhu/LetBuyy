// lib/screens/profile/admin_profile_screen.dart
// 👤 ADVANCED ADMIN PROFILE MANAGEMENT SCREEN

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../app/themes/app_colors.dart';
import '../../app/app_router.dart';
import 'change_email_screen.dart';

class AdminProfileScreen extends StatefulWidget {
  const AdminProfileScreen({super.key});

  @override
  State<AdminProfileScreen> createState() => _AdminProfileScreenState();
}

class _AdminProfileScreenState extends State<AdminProfileScreen> with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  late TabController _tabController;
  
  bool _isLoading = true;
  bool _isSaving = false;
  String? _adminId;
  String? _email;
  String? _name;
  String? _role;
  DateTime? _createdAt;
  DateTime? _lastLogin;
  
  // Activity logs
  List<Map<String, dynamic>> _activityLogs = [];

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAdminData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAdminData() async {
    setState(() => _isLoading = true);
    
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        if (mounted) {
          context.go(AppRouter.login);
        }
        return;
      }

      // Get admin document
      final adminQuery = await FirebaseFirestore.instance
          .collection('admins')
          .where('email', isEqualTo: user.email)
          .limit(1)
          .get();

      if (adminQuery.docs.isNotEmpty) {
        final adminDoc = adminQuery.docs.first;
        final data = adminDoc.data();
        
        setState(() {
          _adminId = adminDoc.id;
          _email = data['email'] ?? user.email;
          _name = data['name'] ?? data['displayName'] ?? 'Admin';
          _role = data['role'] ?? 'admin';
          _createdAt = (data['createdAt'] as Timestamp?)?.toDate();
          _lastLogin = (data['lastLogin'] as Timestamp?)?.toDate();
          _nameController.text = _name ?? '';
        });
        
        // Load activity logs
        _loadActivityLogs();
      }
    } catch (e) {
      debugPrint('Error loading admin data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadActivityLogs() async {
    if (_adminId == null) return;
    
    try {
      final logsQuery = await FirebaseFirestore.instance
          .collection('adminActivityLogs')
          .where('adminId', isEqualTo: _adminId)
          .orderBy('timestamp', descending: true)
          .limit(20)
          .get();
      
      setState(() {
        _activityLogs = logsQuery.docs.map((doc) => doc.data()).toList();
      });
    } catch (e) {
      debugPrint('Error loading activity logs: $e');
    }
  }

  Future<void> _updateProfile() async {
    if (_adminId == null) return;
    
    final newName = _nameController.text.trim();
    if (newName.isEmpty) {
      _showSnackbar('Name cannot be empty', isError: true);
      return;
    }
    
    if (newName == _name) {
      _showSnackbar('No changes to save');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/updateAdminProfile'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'adminId': _adminId,
          'name': newName,
          'displayName': newName,
        }),
      );

      final data = json.decode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        setState(() => _name = newName);
        _showSnackbar('Profile updated successfully', isSuccess: true);
      } else {
        _showSnackbar(data['error'] ?? 'Failed to update profile', isError: true);
      }
    } catch (e) {
      _showSnackbar('Network error. Please try again.', isError: true);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showSnackbar(String message, {bool isError = false, bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
      backgroundColor: isError ? AppColors.error : (isSuccess ? AppColors.success : null),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenWidth = MediaQuery.of(context).size.width;
    final isCompact = screenWidth < 700;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                // App Bar
                SliverAppBar(
                  expandedHeight: isCompact ? 200 : 260,
                  pinned: true,
                  stretch: true,
                  backgroundColor: isDark ? const Color(0xFF1E293B) : AppColors.primary,
                  leading: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    background: _buildProfileHeader(isDark, isCompact),
                  ),
                ),
                
                // Content
                SliverToBoxAdapter(
                  child: Transform.translate(
                    offset: const Offset(0, -30),
                    child: Container(
                      margin: EdgeInsets.symmetric(horizontal: isCompact ? 16 : 40),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          // Tab Bar
                          Container(
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05),
                                ),
                              ),
                            ),
                            child: TabBar(
                              controller: _tabController,
                              labelColor: AppColors.primary,
                              unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
                              indicatorColor: AppColors.primary,
                              indicatorWeight: 3,
                              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                              tabs: const [
                                Tab(text: 'Profile', icon: Icon(Icons.person_outline_rounded, size: 20)),
                                Tab(text: 'Activity', icon: Icon(Icons.history_rounded, size: 20)),
                              ],
                            ),
                          ),
                          
                          // Tab Content
                          SizedBox(
                            height: isCompact ? 500 : 450,
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                _buildProfileTab(isDark, isCompact),
                                _buildActivityTab(isDark),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildProfileHeader(bool isDark, bool isCompact) {
    final initials = (_name ?? 'A').isNotEmpty 
        ? (_name ?? 'A').substring(0, 1).toUpperCase()
        : 'A';

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.7),
            isDark ? const Color(0xFF1E293B) : AppColors.primary.withValues(alpha: 0.5),
          ],
        ),
      ),
      child: SafeArea(
        child: Stack(
          children: [
            // Pattern overlay
            Positioned.fill(
              child: Opacity(
                opacity: 0.1,
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 10,
                    mainAxisSpacing: 2,
                    crossAxisSpacing: 2,
                  ),
                  itemBuilder: (_, __) => Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
            
            // Content
            Center(
              child: Padding(
                padding: EdgeInsets.only(top: isCompact ? 40 : 60),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Avatar
                    Container(
                      width: isCompact ? 80 : 100,
                      height: isCompact ? 80 : 100,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          initials,
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: isCompact ? 32 : 40,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ).animate().scale(duration: 400.ms, curve: Curves.elasticOut),
                    
                    const SizedBox(height: 16),
                    
                    // Name
                    Text(
                      _name ?? 'Admin',
                      style: TextStyle(
                        fontSize: isCompact ? 22 : 28,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    
                    const SizedBox(height: 6),
                    
                    // Role Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.verified_rounded, color: Colors.white, size: 14),
                          const SizedBox(width: 6),
                          Text(
                            (_role ?? 'admin').toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileTab(bool isDark, bool isCompact) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(isCompact ? 20 : 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name Field
          _buildInputSection(
            title: 'Display Name',
            icon: Icons.person_outline_rounded,
            isDark: isDark,
            child: TextField(
              controller: _nameController,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
              decoration: InputDecoration(
                hintText: 'Enter your name',
                hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.black38),
                filled: true,
                fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Save Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSaving ? null : _updateProfile,
              icon: _isSaving 
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save_rounded, size: 18),
              label: Text(_isSaving ? 'Saving...' : 'Save Changes'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          
          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 20),
          
          // Email Section
          _buildInputSection(
            title: 'Email Address',
            icon: Icons.email_outlined,
            isDark: isDark,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(Icons.verified_rounded, color: AppColors.success, size: 14),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _email ?? 'No email',
                              style: TextStyle(
                                color: isDark ? Colors.white : Colors.black,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Double OTP verification required to change',
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.black38,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChangeEmailScreen(
                          adminId: _adminId!,
                          currentEmail: _email!,
                        ),
                      ),
                    ).then((_) => _loadAdminData());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
                    foregroundColor: AppColors.primary,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Change', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Account Info Grid
          _buildInputSection(
            title: 'Account Details',
            icon: Icons.info_outline_rounded,
            isDark: isDark,
            child: Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                _buildInfoChip(
                  Icons.badge_outlined,
                  'Role',
                  (_role ?? 'admin').toUpperCase(),
                  isDark,
                ),
                _buildInfoChip(
                  Icons.calendar_today_rounded,
                  'Joined',
                  _createdAt != null ? DateFormat('MMM d, yyyy').format(_createdAt!) : 'N/A',
                  isDark,
                ),
                _buildInfoChip(
                  Icons.access_time_rounded,
                  'Last Login',
                  _lastLogin != null ? DateFormat('MMM d, hh:mm a').format(_lastLogin!) : 'N/A',
                  isDark,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityTab(bool isDark) {
    if (_activityLogs.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history_rounded, size: 48, color: isDark ? Colors.white24 : Colors.black26),
            const SizedBox(height: 16),
            Text(
              'No activity logs yet',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.black45,
                fontSize: 15,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: _activityLogs.length,
      separatorBuilder: (_, __) => const Divider(height: 24),
      itemBuilder: (context, index) {
        final log = _activityLogs[index];
        final action = log['action']?.toString() ?? 'Unknown action';
        final timestamp = (log['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now();
        
        IconData icon;
        Color color;
        switch (action.toLowerCase()) {
          case 'email_change':
            icon = Icons.email_rounded;
            color = AppColors.info;
            break;
          case 'profile_update':
            icon = Icons.person_rounded;
            color = AppColors.success;
            break;
          case 'login':
            icon = Icons.login_rounded;
            color = AppColors.primary;
            break;
          default:
            icon = Icons.history_rounded;
            color = Colors.grey;
        }

        return Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    action.replaceAll('_', ' ').toUpperCase(),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    DateFormat('MMM d, yyyy • hh:mm a').format(timestamp),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white38 : Colors.black38,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildInputSection({
    required String title,
    required IconData icon,
    required bool isDark,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: AppColors.primary, size: 18),
            const SizedBox(width: 10),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white70 : Colors.black54,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        child,
      ],
    );
  }

  Widget _buildInfoChip(IconData icon, String label, String value, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.primary, size: 16),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  color: isDark ? Colors.white38 : Colors.black38,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
