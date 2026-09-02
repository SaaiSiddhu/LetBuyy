import 'package:flutter/foundation.dart';

import 'api_client.dart';

class FormSubmissionContract {
  const FormSubmissionContract({
    required this.id,
    required this.storeId,
    required this.formType,
    required this.formName,
    required this.data,
    required this.sourceUrl,
    required this.status,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.subject,
    required this.message,
    required this.source,
    required this.createdAt,
    required this.readAt,
    required this.repliedAt,
  });

  factory FormSubmissionContract.fromJson(Map<String, dynamic> json) {
    return FormSubmissionContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      formType: _stringValue(json['form_type'], fallback: 'lead'),
      formName: _stringValue(json['form_name'], fallback: 'Storefront form'),
      data: _mapValue(json['data']),
      sourceUrl: _stringValue(json['source_url']),
      status: _stringValue(json['status'], fallback: 'new'),
      fullName: _stringValue(json['full_name'], fallback: 'Unknown'),
      email: _stringValue(json['email']),
      phone: _stringValue(json['phone']),
      subject: _stringValue(json['subject'], fallback: 'New submission'),
      message: _stringValue(json['message']),
      source: _stringValue(json['source'], fallback: 'form'),
      createdAt: _stringValue(json['created_at']),
      readAt: _stringValue(json['read_at']),
      repliedAt: _stringValue(json['replied_at']),
    );
  }

  final String id;
  final String storeId;
  final String formType;
  final String formName;
  final Map<String, dynamic> data;
  final String sourceUrl;
  final String status;
  final String fullName;
  final String email;
  final String phone;
  final String subject;
  final String message;
  final String source;
  final String createdAt;
  final String readAt;
  final String repliedAt;

  bool get isContact => formType == 'contact';
  bool get isUnread => status == 'new';

  String get typeLabel => isContact ? 'Contact' : 'Lead';

  String get contactLine {
    final parts = [email, phone].where((value) => value.isNotEmpty).toList();
    return parts.isEmpty ? 'No contact details' : parts.join(' / ');
  }
}

class FormSubmissionService extends ChangeNotifier {
  FormSubmissionService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<FormSubmissionContract> _submissions = [];
  List<FormSubmissionContract> get submissions =>
      List.unmodifiable(_submissions);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<FormSubmissionContract>> fetchSubmissions(
    String storeId, {
    String type = 'all',
    String status = 'all',
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.formSubmissions.list(
        storeId: storeId,
        type: type,
        status: status,
      );
      _submissions = response.data
          .map(FormSubmissionContract.fromJson)
          .toList(growable: false);
      return _submissions;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<FormSubmissionContract> updateStatus(
    FormSubmissionContract submission,
    String status,
  ) async {
    final updated = FormSubmissionContract.fromJson(
      await _api.formSubmissions.update(submission.id, {'status': status}),
    );
    _submissions = _submissions
        .map((item) => item.id == updated.id ? updated : item)
        .toList(growable: false);
    notifyListeners();
    return updated;
  }

  Future<void> deleteSubmission(FormSubmissionContract submission) async {
    await _api.formSubmissions.remove(submission.id);
    _submissions = _submissions
        .where((item) => item.id != submission.id)
        .toList(growable: false);
    notifyListeners();
  }
}

Map<String, dynamic> _mapValue(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, value) => MapEntry(key.toString(), value));
  }
  return const {};
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}
