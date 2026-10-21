export function normalizePhoneNumber(value: string): string | null {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function formatOtpErrorMessage(message?: string): string {
  if (!message) return 'Invalid or expired OTP';
  if (/signups? not allowed for otp/i.test(message)) {
    return 'OTP for login service is disabled. Please login with email and password.';
  }
  return message
    .replace(/\bToken\b/g, 'OTP')
    .replace(/\btoken\b/g, 'otp');
}

export function getPhoneAuthErrorMessage(message?: string): string {
  if (/signups? not allowed for otp/i.test(message || '')) {
    return 'OTP for login service is disabled. Please login with email and password.';
    //'Phone sign-up is disabled in Supabase. Ask the project admin to enable Authentication > Sign In / Providers > Phone and allow new sign-ups.'
  }
  return formatOtpErrorMessage(message || 'Phone verification failed. Check the Supabase Phone provider and SMS configuration.');
}