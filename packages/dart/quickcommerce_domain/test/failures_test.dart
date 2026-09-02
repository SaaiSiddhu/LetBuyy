import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:test/test.dart';

void main() {
  test('maps API inventory errors to typed failures', () {
    final failure = failureFromApiError({
      'code': ErrorCodes.inventoryOutOfStock,
      'message': 'Out of stock',
      'retryable': false,
      'details': {'variantId': 'v1'},
    });

    expect(failure, isA<InventoryFailure>());
    expect(failure.retryable, isFalse);
    expect(failure.details['variantId'], 'v1');
  });

  test('Result folds success and failure exhaustively', () {
    const Result<int, AppFailure> ok = Ok(1);
    const Result<int, AppFailure> err = Err(ValidationFailure());

    expect(ok.fold(ok: (value) => value + 1, err: (_) => 0), 2);
    expect(err.fold(ok: (value) => value, err: (failure) => failure.code),
        ErrorCodes.requestValidationFailed);
  });
}
