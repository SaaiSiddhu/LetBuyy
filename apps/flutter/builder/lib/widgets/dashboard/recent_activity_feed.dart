import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';

class RecentActivityFeed extends StatelessWidget {
  const RecentActivityFeed({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Live Activity',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            TextButton(
              onPressed: () {},
              child: Text('See All', style: TextStyle(color: Colors.blueAccent)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: const [
            _ActivityItem(
              icon: Icons.shopping_bag_rounded,
              iconColor: Colors.blueAccent,
              title: 'New Order #1024',
              subtitle: 'Just now • ₹1,299',
              trailing: 'Pending',
              trailingColor: Colors.amber,
            ),
            SizedBox(height: 12),
            _ActivityItem(
              icon: Icons.person_add_rounded,
              iconColor: Colors.purpleAccent,
              title: 'New Customer',
              subtitle: '2 mins ago • Rahul S.',
              trailing: 'Verified',
              trailingColor: Colors.green,
            ),
            SizedBox(height: 12),
            _ActivityItem(
              icon: Icons.inventory_2_rounded,
              iconColor: Colors.orangeAccent,
              title: 'Low Stock Alert',
              subtitle: '10 mins ago • Blue T-Shirt',
              trailing: 'Action',
              trailingColor: Colors.redAccent,
            ),
          ],
        ),
      ],
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String trailing;
  final Color trailingColor;

  const _ActivityItem({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.trailingColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: trailingColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: trailingColor.withValues(alpha: 0.3)),
            ),
            child: Text(
              trailing,
              style: TextStyle(
                color: trailingColor,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
