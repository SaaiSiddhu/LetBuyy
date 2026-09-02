import '../common/failures.dart';
import '../common/result.dart';
import '../common/value_objects.dart';
import '../entities/entities.dart';
import '../repositories/repositories.dart';

abstract interface class UseCase<Output, Input> {
  Future<Result<Output, AppFailure>> call(Input input);
}

final class RequestOtpInput {
  const RequestOtpInput({required this.phone, required this.traceId});

  final String phone;
  final TraceId traceId;
}

final class RequestOtp implements UseCase<void, RequestOtpInput> {
  const RequestOtp(this._repository);

  final AuthRepository _repository;

  @override
  Future<Result<void, AppFailure>> call(RequestOtpInput input) {
    return _repository.requestPhoneOtp(
        phone: input.phone, traceId: input.traceId);
  }
}

final class VerifyOtpInput {
  const VerifyOtpInput({
    required this.phone,
    required this.otp,
    required this.traceId,
  });

  final String phone;
  final String otp;
  final TraceId traceId;
}

final class VerifyOtp implements UseCase<AuthSession, VerifyOtpInput> {
  const VerifyOtp(this._repository);

  final AuthRepository _repository;

  @override
  Future<Result<AuthSession, AppFailure>> call(VerifyOtpInput input) {
    return _repository.signInWithPhoneOtp(
        phone: input.phone, otp: input.otp, traceId: input.traceId);
  }
}

final class CreateCheckoutQuote
    implements UseCase<CheckoutQuote, CreateCheckoutQuoteCommand> {
  const CreateCheckoutQuote(this._repository);

  final CheckoutRepository _repository;

  @override
  Future<Result<CheckoutQuote, AppFailure>> call(
      CreateCheckoutQuoteCommand input) {
    return _repository.createQuote(input);
  }
}

final class TransitionDelivery
    implements UseCase<Delivery, DeliveryTransitionCommand> {
  const TransitionDelivery(this._repository);

  final DeliveryRepository _repository;

  @override
  Future<Result<Delivery, AppFailure>> call(DeliveryTransitionCommand input) {
    return _repository.transitionDelivery(input);
  }
}
