import { describe, expect, it } from 'vitest';
import { getPhoneAuthErrorMessage, normalizePhoneNumber } from './phone';

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

describe('getPhoneAuthErrorMessage', () => {
  it('explains how to resolve disabled OTP sign-ups', () => {
    expect(getPhoneAuthErrorMessage('Signups not allowed for otp')).toContain('enable Authentication');
  });

  it('preserves other provider errors', () => {
    expect(getPhoneAuthErrorMessage('SMS provider unavailable')).toBe('SMS provider unavailable');
  });
});