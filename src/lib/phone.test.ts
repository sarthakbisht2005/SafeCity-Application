import { describe, expect, it } from 'vitest';
import { formatOtpErrorMessage, getPhoneAuthErrorMessage, normalizePhoneNumber } from './phone';

describe('normalizePhoneNumber', () => {
  it('removes display formatting from international numbers', () => {
    expect(normalizePhoneNumber('+91 7983906169')).toBe('+917983906169');
    expect(normalizePhoneNumber('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('rejects numbers that are not valid E.164 values', () => {
    expect(normalizePhoneNumber('7983906169')).toBeNull();
    expect(normalizePhoneNumber('+0123456789')).toBeNull();
    expect(normalizePhoneNumber('+91 123')).toBeNull();
    expect(normalizePhoneNumber('+91abc7983906169')).toBeNull();
  });
});

describe('formatOtpErrorMessage', () => {
  it('replaces Token with OTP in error messages', () => {
    expect(formatOtpErrorMessage('Token has expired or is invalid')).toBe('OTP has expired or is invalid');
    expect(formatOtpErrorMessage('Invalid token provided')).toBe('Invalid otp provided');
  });

  it('returns friendly message when signups are not allowed', () => {
    expect(formatOtpErrorMessage('Signups not allowed for otp')).toBe(
      'OTP for login service is disabled. Please login with email and password.'
    );
  });
});

describe('getPhoneAuthErrorMessage', () => {
  it('explains that OTP login service is disabled', () => {
    expect(getPhoneAuthErrorMessage('Signups not allowed for otp')).toBe(
      'Phone OTP login service is disabled. Please login with email otp or password.'
    );
  });

  it('replaces token with otp in provider errors', () => {
    expect(getPhoneAuthErrorMessage('Token has expired or is invalid')).toBe('OTP has expired or is invalid');
  });

  it('preserves other provider errors', () => {
    expect(getPhoneAuthErrorMessage('SMS provider unavailable')).toBe('SMS provider unavailable');
  });
});