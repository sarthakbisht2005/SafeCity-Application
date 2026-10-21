import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Eye, EyeOff, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getPhoneAuthErrorMessage, normalizePhoneNumber } from '@/lib/phone';
import { toast } from 'sonner';

type LoginMode = 'password' | 'otp';

function isPhoneLike(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.includes('@')) return false;
  return /^[+]?[\d\s().-]+$/.test(trimmed);
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<LoginMode>('password');

  // Password Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // OTP Login state
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTarget, setOtpTarget] = useState('');
  const [otpType, setOtpType] = useState<'email' | 'sms'>('sms');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = identifier.trim();
    if (!raw) {
      toast.error('Please enter your email or phone number');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(raw, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid credentials. Please verify your email/phone and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = otpIdentifier.trim();
    if (!raw) {
      toast.error('Please enter your email or phone number');
      return;
    }

    setLoading(true);
    try {
      if (raw.includes('@')) {
        // Email OTP
        const email = raw.toLowerCase();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setOtpTarget(email);
        setOtpType('email');
        setOtpSent(true);
        toast.success(`OTP sent to ${email}!`);
      } else {
        // Phone OTP
        const cleanDigits = raw.replace(/[\s().-]/g, '');
        const normalized = normalizePhoneNumber(raw) || (cleanDigits.startsWith('+') ? cleanDigits : `+91${cleanDigits}`);
        if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
          toast.error('Enter a valid phone number, including country code (e.g. +91 9876543210)');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithOtp({
          phone: normalized,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setOtpTarget(normalized);
        setOtpType('sms');
        setOtpSent(true);
        toast.success(`OTP sent to ${normalized}!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      if (raw.includes('@')) {
        toast.error(msg || 'Failed to send OTP to email. Check if your account exists.');
      } else {
        toast.error(getPhoneAuthErrorMessage(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      if (otpType === 'email') {
        const { error } = await supabase.auth.verifyOtp({
          email: otpTarget,
          token: cleanOtp,
          type: 'email',
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: otpTarget,
          token: cleanOtp,
          type: 'sms',
        });
        if (error) throw error;
      }

      toast.success('Welcome back!');
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed. Check the Supabase Google provider settings.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to MySafeCity</p>
            {location.state?.emailVerificationRequired && (
              <p role="status" className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                Your account was created. Verify your email, then sign in.
              </p>
            )}
          </div>

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 mb-4 min-h-[44px]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Mode tabs */}
          <div className="flex rounded-xl border border-input overflow-hidden mb-6 p-0.5 bg-secondary/50">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-[40px] ${
                mode === 'password' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-1.5" />
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setOtpSent(false);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-[40px] ${
                mode === 'otp' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Phone className="w-4 h-4 inline mr-1.5" />
              OTP Login
            </button>
          </div>

          {/* OTP Login Form */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email or Phone No</label>
                <div className="relative">
                  {otpIdentifier.includes('@') ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  )}
                  <input
                    type="text"
                    value={otpIdentifier}
                    onChange={e => setOtpIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="sarthak@mail.com or +91 9876543210"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px]"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* OTP Verification Form */}
          {mode === 'otp' && otpSent && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                OTP sent to <span className="font-semibold text-foreground">{otpTarget}</span>
              </p>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-center tracking-[0.5em] font-mono focus:ring-2 focus:ring-primary/30 outline-none"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px]"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  className="hover:text-primary transition-colors disabled:opacity-50"
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                  className="hover:text-foreground transition-colors"
                >
                  Change email or phone
                </button>
              </div>
            </form>
          )}

          {/* Password Login Form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email or Phone No</label>
                <div className="relative">
                  {isPhoneLike(identifier) ? (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  )}
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="admin@mysafecity.com or +91 9343579549"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px]"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
