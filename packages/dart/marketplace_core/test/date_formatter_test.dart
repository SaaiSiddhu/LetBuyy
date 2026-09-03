import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

void main() {
  group('DateFormatter fixed-date formatting', () {
    // A fixed, arbitrary date -- these functions take the date as an
    // explicit parameter, so unlike the *Now()-dependent group below they
    // carry no time-of-test dependency.
    final date = DateTime(2026, 10, 25, 14, 30);

    test('formatDate produces "dd MMM yyyy"', () {
      expect(DateFormatter.formatDate(date), '25 Oct 2026');
    });

    test('formatTime produces 12-hour "hh:mm a"', () {
      expect(DateFormatter.formatTime(date), '02:30 PM');
    });

    test('formatDateTime combines both', () {
      expect(DateFormatter.formatDateTime(date), '25 Oct 2026, 02:30 PM');
    });

    test('formatDateSlash produces "dd/MM/yyyy"', () {
      expect(DateFormatter.formatDateSlash(date), '25/10/2026');
    });

    test('formatDateLong spells out the month', () {
      expect(DateFormatter.formatDateLong(date), 'October 25, 2026');
    });

    test('formatMonthName returns just the month', () {
      expect(DateFormatter.formatMonthName(date), 'October');
    });

    test('formatYear returns just the year', () {
      expect(DateFormatter.formatYear(date), '2026');
    });

    test('a midnight time formats as 12:00 AM, not 00:00', () {
      // A real 12-hour-clock boundary case: hour 0 must map to "12", not "0".
      final midnight = DateTime(2026, 1, 1, 0, 0);
      expect(DateFormatter.formatTime(midnight), '12:00 AM');
    });

    test('a noon time formats as 12:00 PM, not 00:00', () {
      final noon = DateTime(2026, 1, 1, 12, 0);
      expect(DateFormatter.formatTime(noon), '12:00 PM');
    });

    test(
      'formatDayName / formatDateShort agree with DateTime.weekday '
      '(cross-checks intl\'s weekday-name formatting against core Dart\'s '
      'own weekday numbering, independent systems that could disagree)',
      () {
        const fullNames = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ];
        const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        final expectedFull = fullNames[date.weekday - 1];
        final expectedShort = shortNames[date.weekday - 1];

        expect(DateFormatter.formatDayName(date), expectedFull);
        expect(
          DateFormatter.formatDateShort(date),
          '$expectedShort, Oct 25',
        );
      },
    );

    test('formatDeliveryDateRange joins two short dates with a dash', () {
      expect(
        DateFormatter.formatDeliveryDateRange(
          DateTime(2026, 6, 1),
          DateTime(2026, 6, 5),
        ),
        '01 Jun - 05 Jun',
      );
    });
  });

  group('DateFormatter.parseDate', () {
    test('parses a valid ISO-8601 string', () {
      final parsed = DateFormatter.parseDate('2026-06-01T10:00:00.000Z');
      expect(parsed, isNotNull);
      expect(parsed!.year, 2026);
      expect(parsed.month, 6);
      expect(parsed.day, 1);
    });

    test('returns null for unparseable input instead of throwing', () {
      expect(DateFormatter.parseDate('not a date'), isNull);
    });
  });

  group('DateFormatter.formatDuration', () {
    test('formats a sub-hour duration in minutes', () {
      expect(DateFormatter.formatDuration(const Duration(minutes: 45)), '45 minutes');
    });

    test('formats exactly 1 minute in the singular', () {
      expect(DateFormatter.formatDuration(const Duration(minutes: 1)), '1 minute');
    });

    test('formats an hours-and-minutes duration', () {
      expect(
        DateFormatter.formatDuration(const Duration(hours: 2, minutes: 30)),
        '2hrs 30mins',
      );
    });

    test('formats a days-and-hours duration', () {
      expect(
        DateFormatter.formatDuration(const Duration(days: 1, hours: 5)),
        '1day 5hrs',
      );
    });
  });

  group('DateFormatter *Now()-relative functions', () {
    // These read DateTime.now() internally and take no clock parameter, so
    // every input here is computed relative to "now" at test-run time --
    // never a hardcoded date, which would eventually go stale and either
    // flake or silently stop exercising the intended branch.

    test('getRelativeTime: under a minute reads "Just now"', () {
      final justNow = DateTime.now().subtract(const Duration(seconds: 5));
      expect(DateFormatter.getRelativeTime(justNow), 'Just now');
    });

    test('getRelativeTime: pluralizes minutes correctly', () {
      final oneMinuteAgo = DateTime.now().subtract(const Duration(minutes: 1));
      final fiveMinutesAgo = DateTime.now().subtract(const Duration(minutes: 5));
      expect(DateFormatter.getRelativeTime(oneMinuteAgo), '1 minute ago');
      expect(DateFormatter.getRelativeTime(fiveMinutesAgo), '5 minutes ago');
    });

    test('getRelativeTime: pluralizes hours correctly', () {
      final twoHoursAgo = DateTime.now().subtract(const Duration(hours: 2));
      expect(DateFormatter.getRelativeTime(twoHoursAgo), '2 hours ago');
    });

    test('getTimeAgoShort: compact suffix form', () {
      final twoHoursAgo = DateTime.now().subtract(const Duration(hours: 2));
      expect(DateFormatter.getTimeAgoShort(twoHoursAgo), '2h');
    });

    test('isToday is true for now and false for eight days ago', () {
      expect(DateFormatter.isToday(DateTime.now()), isTrue);
      expect(
        DateFormatter.isToday(DateTime.now().subtract(const Duration(days: 8))),
        isFalse,
      );
    });

    test('isYesterday is true exactly 1 day back, false for today', () {
      expect(
        DateFormatter.isYesterday(
          DateTime.now().subtract(const Duration(days: 1)),
        ),
        isTrue,
      );
      expect(DateFormatter.isYesterday(DateTime.now()), isFalse);
    });

    test('isFuture / isPast are opposite for a date 1 day ahead vs. behind', () {
      final future = DateTime.now().add(const Duration(days: 1));
      final past = DateTime.now().subtract(const Duration(days: 1));

      expect(DateFormatter.isFuture(future), isTrue);
      expect(DateFormatter.isPast(future), isFalse);
      expect(DateFormatter.isFuture(past), isFalse);
      expect(DateFormatter.isPast(past), isTrue);
    });

    test('getDaysUntil counts forward for a future date', () {
      final in10Days = DateTime.now().add(const Duration(days: 10, hours: 1));
      expect(DateFormatter.getDaysUntil(in10Days), 10);
    });

    test('getDaysUntil is negative for a past date', () {
      final tenDaysAgo = DateTime.now().subtract(const Duration(days: 10));
      expect(DateFormatter.getDaysUntil(tenDaysAgo), lessThan(0));
    });

    test('getGreeting returns one of the three known greetings', () {
      // The branch actually taken depends on the wall-clock hour the suite
      // runs at, which this test cannot control without a clock injection
      // point the source doesn't provide -- so it asserts the function
      // returns one of its three legitimate outputs, not a specific one.
      expect(
        DateFormatter.getGreeting(),
        anyOf('Good Morning', 'Good Afternoon', 'Good Evening'),
      );
    });

    test(
      'getEstimatedDeliveryDate never lands on a weekend',
      () {
        // This function anchors to DateTime.now() internally, so it cannot
        // be driven from an arbitrary fixed start date. Instead, verify its
        // documented invariant directly: whatever date it returns must never
        // itself fall on a Saturday or Sunday.
        final delivery = DateFormatter.getEstimatedDeliveryDate(3);
        expect(delivery.weekday, isNot(DateTime.saturday));
        expect(delivery.weekday, isNot(DateTime.sunday));
        expect(delivery.isAfter(DateTime.now()), isTrue);
      },
    );
  });
}
