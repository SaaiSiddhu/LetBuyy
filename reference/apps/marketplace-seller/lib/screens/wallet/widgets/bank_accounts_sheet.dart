// lib/screens/wallet/widgets/bank_accounts_sheet.dart
// 🏦 Bank Accounts Management Sheet

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../models/bank_account_model.dart';
import '../../../services/bank_account_service.dart';

class BankAccountsSheet extends StatefulWidget {
  final String sellerId;
  final bool isDark;
  final Function(BankAccountModel)? onAccountSelected;

  const BankAccountsSheet({
    super.key,
    required this.sellerId,
    required this.isDark,
    this.onAccountSelected,
  });

  @override
  State<BankAccountsSheet> createState() => _BankAccountsSheetState();
}

class _BankAccountsSheetState extends State<BankAccountsSheet> {
  bool _isAddingNew = false;
  final _formKey = GlobalKey<FormState>();
  final _accountHolderController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _ifscController = TextEditingController();
  String? _bankName;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[400],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.account_balance, color: Colors.teal, size: 24),
                const SizedBox(width: 12),
                Text(
                  _isAddingNew ? 'Add Bank Account' : 'Bank Accounts',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: widget.isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const Spacer(),
                if (!_isAddingNew)
                  TextButton.icon(
                    onPressed: () => setState(() => _isAddingNew = true),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Add'),
                  ),
              ],
            ),
          ),
          
          const Divider(height: 1),
          
          // Content
          if (_isAddingNew)
            _buildAddAccountForm()
          else
            _buildAccountsList(),
        ],
      ),
    );
  }

  Widget _buildAccountsList() {
    return StreamBuilder<List<BankAccountModel>>(
      stream: BankAccountService.getBankAccounts(widget.sellerId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final accounts = snapshot.data ?? [];
        
        if (accounts.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                Icon(Icons.account_balance_outlined, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  'No bank accounts added',
                  style: TextStyle(color: Colors.grey[600]),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => setState(() => _isAddingNew = true),
                  icon: const Icon(Icons.add),
                  label: const Text('Add Bank Account'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          itemCount: accounts.length,
          itemBuilder: (context, i) => _buildAccountCard(accounts[i]),
        );
      },
    );
  }

  Widget _buildAccountCard(BankAccountModel account) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: account.isPrimary ? Colors.teal : Colors.transparent,
          width: 2,
        ),
      ),
      child: InkWell(
        onTap: () => widget.onAccountSelected?.call(account),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.teal.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.account_balance, color: Colors.teal),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          account.bankName,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: widget.isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        if (account.isPrimary) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.teal,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('PRIMARY', style: TextStyle(color: Colors.white, fontSize: 9)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      account.accountNumberMasked,
                      style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                    ),
                    Text(
                      account.accountHolderName,
                      style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                    ),
                  ],
                ),
              ),
              if (!account.isPrimary)
                PopupMenuButton(
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'primary', child: Text('Set as Primary')),
                    const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
                  ],
                  onSelected: (value) async {
                    if (value == 'primary') {
                      await BankAccountService.setPrimaryAccount(widget.sellerId, account.id);
                    } else if (value == 'delete') {
                      await BankAccountService.deleteBankAccount(account.id);
                    }
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAddAccountForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _accountHolderController,
              decoration: InputDecoration(
                labelText: 'Account Holder Name',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _accountNumberController,
              decoration: InputDecoration(
                labelText: 'Account Number',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _ifscController,
              decoration: InputDecoration(
                labelText: 'IFSC Code',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                suffixIcon: _isLoading 
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : null,
              ),
              textCapitalization: TextCapitalization.characters,
              onChanged: _lookupIfsc,
              validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
            ),
            if (_bankName != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green, size: 18),
                    const SizedBox(width: 8),
                    Text(_bankName!, style: TextStyle(color: Colors.green)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _isAddingNew = false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _saveAccount,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Add Account'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _lookupIfsc(String ifsc) async {
    if (ifsc.length < 4) {
      setState(() => _bankName = null);
      return;
    }
    
    setState(() => _isLoading = true);
    final result = await BankAccountService.lookupIfsc(ifsc);
    setState(() {
      _isLoading = false;
      _bankName = result?['bankName'];
    });
  }

  Future<void> _saveAccount() async {
    if (!_formKey.currentState!.validate()) return;
    if (_bankName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid IFSC code')),
      );
      return;
    }

    try {
      await BankAccountService.addBankAccount(
        sellerId: widget.sellerId,
        accountHolderName: _accountHolderController.text,
        accountNumber: _accountNumberController.text,
        ifscCode: _ifscController.text,
        bankName: _bankName!,
      );
      
      setState(() => _isAddingNew = false);
      _accountHolderController.clear();
      _accountNumberController.clear();
      _ifscController.clear();
      _bankName = null;
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bank account added!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  void dispose() {
    _accountHolderController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    super.dispose();
  }
}
