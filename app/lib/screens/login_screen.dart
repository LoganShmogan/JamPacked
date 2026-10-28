import 'package:flutter/material.dart';

import '../services/convex_client.dart';
import '../theme.dart';
import '../widgets/business_form.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _business = GlobalKey<BusinessFormState>();
  bool _register = false;
  bool _busy = false;
  bool _obscure = true;

  /// Sign-up is two steps: your account, then your main business (skipped when invited).
  bool _businessStep = false;
  bool _invited = false;

  Future<void> _submit() async {
    if (!_businessStep && !_form.currentState!.validate()) return;
    if (_register && !_invited && !_businessStep) {
      setState(() => _businessStep = true);
      return;
    }
    final business = _businessStep ? _business.currentState!.collect() : null;
    if (_businessStep && business == null) return;
    setState(() => _busy = true);
    try {
      if (_register) {
        await context.auth.register(
          _name.text.trim(),
          _email.text.trim(),
          _password.text,
          business: business,
        );
      } else {
        await context.auth.login(_email.text.trim(), _password.text);
      }
    } on ConvexException catch (e) {
      if (mounted) context.toast(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: _businessStep ? 640 : 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: 20),
                        child: AppLogo(size: 96),
                      ),
                    ),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        'JamPacked',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium!
                            .copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Food safety records for NZ & Australian businesses',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted),
                    ),
                    const SizedBox(height: 32),
                    if (_businessStep) ...[
                      Text(
                        'Set up your main business',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'You can add more businesses later.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 16),
                      BusinessForm(key: _business),
                      const SizedBox(height: 24),
                    ] else ...[
                      if (_register) ...[
                        TextFormField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Full name',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                          validator: (v) =>
                              v!.trim().isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 12),
                      ],
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                        validator: (v) =>
                            v!.contains('@') ? null : 'Enter a valid email',
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (v) => _register && v!.length < 8
                            ? 'At least 8 characters'
                            : null,
                      ),
                      if (_register)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          controlAffinity: ListTileControlAffinity.leading,
                          value: _invited,
                          onChanged: (v) => setState(() => _invited = v!),
                          title: const Text(
                            "I've been invited to join an existing business",
                          ),
                        ),
                      const SizedBox(height: 24),
                    ],
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                              ),
                            )
                          : Text(
                              !_register
                                  ? 'Sign in'
                                  : _invited || _businessStep
                                  ? 'Create account'
                                  : 'Next',
                            ),
                    ),
                    const SizedBox(height: 8),
                    if (_businessStep)
                      TextButton(
                        onPressed: () => setState(() => _businessStep = false),
                        child: const Text('Back'),
                      )
                    else
                      TextButton(
                        onPressed: () => setState(() => _register = !_register),
                        child: Text(
                          _register
                              ? 'I already have an account'
                              : 'Create an account',
                        ),
                      ),
                    if (_register && !_businessStep)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _invited
                              ? 'Use the email address you were invited with.'
                              : 'Next you will set up your business and choose the programme it follows.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    const SizedBox(height: 24),
                    const Text(
                      '© Save Point Limited',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
