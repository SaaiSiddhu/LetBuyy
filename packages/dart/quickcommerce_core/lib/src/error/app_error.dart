class AppError {
  const AppError({
    required this.message,
    this.code,
    this.cause,
    this.stackTrace,
  });

  final String message;
  final String? code;
  final Object? cause;
  final StackTrace? stackTrace;

  @override
  String toString() {
    if (code == null) {
      return 'AppError(message: $message)';
    }
    return 'AppError(code: $code, message: $message)';
  }
}
