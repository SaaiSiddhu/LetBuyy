import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

void main() {
  group('Validators.validateEmail', () {
    test('rejects null and empty', () {
      expect(Validators.validateEmail(null), 'Email is required');
      expect(Validators.validateEmail(''), 'Email is required');
    });

    test('rejects a value with no @ or domain', () {
      expect(
        Validators.validateEmail('not-an-email'),
        'Please enter a valid email address',
      );
    });

    test('accepts a well-formed address', () {
      expect(Validators.validateEmail('meera@example.com'), isNull);
    });
  });

  group('Validators.validatePassword (strict)', () {
    test('rejects null and empty', () {
      expect(Validators.validatePassword(null), 'Password is required');
      expect(Validators.validatePassword(''), 'Password is required');
    });

    test('rejects fewer than 8 characters', () {
      expect(
        Validators.validatePassword('Ab1!'),
        'Password must be at least 8 characters',
      );
    });

    test('rejects missing an uppercase letter', () {
      expect(
        Validators.validatePassword('lowercase1!'),
        'Password must contain at least one uppercase letter',
      );
    });

    test('rejects missing a lowercase letter', () {
      expect(
        Validators.validatePassword('UPPERCASE1!'),
        'Password must contain at least one lowercase letter',
      );
    });

    test('rejects missing a digit', () {
      expect(
        Validators.validatePassword('NoDigitsHere!'),
        'Password must contain at least one number',
      );
    });

    test('rejects missing a special character', () {
      expect(
        Validators.validatePassword('NoSpecial1'),
        'Password must contain at least one special character',
      );
    });

    test('accepts a password satisfying every rule', () {
      expect(Validators.validatePassword('Str0ng!Pass'), isNull);
    });
  });

  group('Validators.validateSimplePassword', () {
    test('accepts a 6-character password with no complexity rules', () {
      expect(Validators.validateSimplePassword('abcdef'), isNull);
    });

    test('rejects fewer than 6 characters', () {
      expect(
        Validators.validateSimplePassword('abcde'),
        'Password must be at least 6 characters',
      );
    });
  });

  group('Validators.validateConfirmPassword', () {
    test('rejects a mismatch', () {
      expect(
        Validators.validateConfirmPassword('different', 'original'),
        'Passwords do not match',
      );
    });

    test('accepts an exact match', () {
      expect(
        Validators.validateConfirmPassword('samesame', 'samesame'),
        isNull,
      );
    });
  });

  group('Validators.validateName', () {
    test('rejects fewer than 2 characters', () {
      expect(Validators.validateName('A'), 'Name must be at least 2 characters');
    });

    test('rejects digits and symbols', () {
      expect(
        Validators.validateName('Meera2'),
        'Name can only contain letters and spaces',
      );
    });

    test('accepts letters with spaces', () {
      expect(Validators.validateName('Meera Merchant'), isNull);
    });
  });

  group('Validators.validatePhone (Indian format)', () {
    test('rejects a number that is not 10 digits after stripping symbols', () {
      expect(
        Validators.validatePhone('+91 999'),
        'Phone number must be 10 digits',
      );
    });

    test('rejects a 10-digit number starting with a disallowed digit', () {
      // Indian mobile numbers start 6-9; a landline-style 10-digit number
      // starting with 5 must be rejected even though the length is right.
      expect(
        Validators.validatePhone('5999999999'),
        'Please enter a valid phone number',
      );
    });

    test('accepts a well-formed number with punctuation stripped', () {
      // Symbols are stripped before length/pattern checks -- but note this
      // means a country-code-prefixed number ("+91 99999 99999", 12 digits
      // once stripped) would NOT validate, since exactly 10 digits are
      // required after stripping. This validator expects the bare 10-digit
      // number only.
      expect(Validators.validatePhone('99999-99999'), isNull);
    });
  });

  group('Validators.validatePincode (Indian format)', () {
    test('rejects a pincode starting with 0', () {
      expect(Validators.validatePincode('012345'), 'Please enter a valid pincode');
    });

    test('rejects the wrong digit count', () {
      expect(Validators.validatePincode('12345'), 'Pincode must be 6 digits');
    });

    test('accepts a valid 6-digit pincode', () {
      expect(Validators.validatePincode('560001'), isNull);
    });
  });

  group('Validators.validateRequired', () {
    test('names the field in the error message', () {
      expect(Validators.validateRequired('', 'Store name'), 'Store name is required');
      expect(Validators.validateRequired(null, 'Store name'), 'Store name is required');
    });

    test('accepts any non-empty value', () {
      expect(Validators.validateRequired('x', 'Store name'), isNull);
    });
  });

  group('Validators.validateNumber', () {
    test('rejects non-numeric input', () {
      expect(
        Validators.validateNumber('abc', fieldName: 'Quantity'),
        'Please enter a valid number',
      );
    });

    test('accepts a negative number (this validator does not range-check)', () {
      // Distinguishes validateNumber from validatePrice/validateStock, which
      // do add a positivity check on top of the same parse.
      expect(Validators.validateNumber('-5'), isNull);
    });
  });

  group('Validators.validatePrice', () {
    test('rejects zero', () {
      expect(Validators.validatePrice('0'), 'Price must be greater than 0');
    });

    test('rejects a negative price', () {
      expect(Validators.validatePrice('-1'), 'Price must be greater than 0');
    });

    test('accepts a positive decimal price', () {
      expect(Validators.validatePrice('1299.50'), isNull);
    });
  });

  group('Validators.validateStock', () {
    test('rejects a negative stock count', () {
      expect(Validators.validateStock('-1'), 'Stock cannot be negative');
    });

    test('accepts zero stock (out of stock is a valid state, not an error)', () {
      expect(Validators.validateStock('0'), isNull);
    });
  });

  group('Validators.validateUrl', () {
    test('treats an empty URL as valid (optional field)', () {
      expect(Validators.validateUrl(''), isNull);
      expect(Validators.validateUrl(null), isNull);
    });

    test('rejects a string with no domain shape', () {
      expect(Validators.validateUrl('not a url'), 'Please enter a valid URL');
    });

    test('accepts a well-formed https URL', () {
      expect(Validators.validateUrl('https://letbuyy.com/store'), isNull);
    });
  });

  group('Validators.validateAddress', () {
    test('rejects an address shorter than 10 characters', () {
      expect(
        Validators.validateAddress('Too short'),
        'Address must be at least 10 characters',
      );
    });

    test('accepts a sufficiently long address', () {
      expect(Validators.validateAddress('12 Market Road, Bengaluru'), isNull);
    });
  });

  group('Validators.validateCouponCode', () {
    test('rejects a code shorter than 4 characters', () {
      expect(Validators.validateCouponCode('AB1'), 'Invalid coupon code');
    });

    test('accepts a 4+ character code', () {
      expect(Validators.validateCouponCode('SAVE10'), isNull);
    });
  });

  group('Validators.validateRange', () {
    test('rejects a value below the minimum', () {
      expect(
        Validators.validateRange('5', 10, 100, 'Discount'),
        'Discount must be between 10.0 and 100.0',
      );
    });

    test('rejects a value above the maximum', () {
      expect(
        Validators.validateRange('150', 10, 100, 'Discount'),
        'Discount must be between 10.0 and 100.0',
      );
    });

    test('accepts a value at each inclusive boundary', () {
      expect(Validators.validateRange('10', 10, 100, 'Discount'), isNull);
      expect(Validators.validateRange('100', 10, 100, 'Discount'), isNull);
    });
  });

  group('Validators.validateCreditCard (Luhn algorithm)', () {
    test('rejects a number that fails the Luhn checksum', () {
      // One digit off from a valid test number -- must fail the checksum,
      // not just a length check.
      expect(
        Validators.validateCreditCard('4111 1111 1111 1112'),
        'Invalid card number',
      );
    });

    test('accepts a well-known Luhn-valid test number', () {
      // 4111111111111111 is the standard Luhn-valid Visa test number.
      expect(Validators.validateCreditCard('4111 1111 1111 1111'), isNull);
    });

    test('rejects a number outside the 13-19 digit range', () {
      expect(Validators.validateCreditCard('123456789012'), 'Invalid card number');
    });
  });

  group('Validators.validateCVV', () {
    test('accepts 3 or 4 digits', () {
      expect(Validators.validateCVV('123'), isNull);
      expect(Validators.validateCVV('1234'), isNull);
    });

    test('rejects non-digit characters', () {
      expect(Validators.validateCVV('12a'), 'CVV must contain only numbers');
    });

    test('rejects the wrong length', () {
      expect(Validators.validateCVV('12'), 'Invalid CVV');
      expect(Validators.validateCVV('12345'), 'Invalid CVV');
    });
  });

  group('Validators.validateExpiryDate', () {
    // DateTime.now()-dependent: chosen values are safe for the practical
    // lifetime of this test suite -- "01/20" is unambiguously in the past
    // for any year this repository will be worked on, and "12/99" (year 99)
    // stays in the future until the two-digit year itself rolls to 99
    // again, around the year 2099.
    test('rejects an unparseable format', () {
      expect(Validators.validateExpiryDate('13-25'), 'Invalid format (use MM/YY)');
    });

    test('rejects a month outside 1-12', () {
      expect(Validators.validateExpiryDate('13/30'), 'Invalid month');
    });

    test('rejects a clearly expired date', () {
      expect(Validators.validateExpiryDate('01/20'), 'Card has expired');
    });

    test('accepts a date far in the future', () {
      expect(Validators.validateExpiryDate('12/99'), isNull);
    });
  });

  group('Validators standalone predicates', () {
    test('isAlphanumeric rejects spaces and punctuation', () {
      expect(Validators.isAlphanumeric('abc123'), isTrue);
      expect(Validators.isAlphanumeric('abc 123'), isFalse);
      expect(Validators.isAlphanumeric('abc-123'), isFalse);
    });

    test('isValidIndianMobile matches the same rule as validatePhone', () {
      expect(Validators.isValidIndianMobile('9999999999'), isTrue);
      expect(Validators.isValidIndianMobile('5999999999'), isFalse);
    });

    test('isValidEmailDomain checks a suffix match against the allow-list', () {
      expect(
        Validators.isValidEmailDomain('merchant@letbuyy.com', ['letbuyy.com']),
        isTrue,
      );
      expect(
        Validators.isValidEmailDomain('merchant@gmail.com', ['letbuyy.com']),
        isFalse,
      );
    });
  });
}
