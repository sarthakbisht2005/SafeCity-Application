import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthState } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchUserProfile(session: Session): Promise<User> {
  const uid = session.user.id;
  const email = session.user.email || '';

  // Get profile, roles, and access status in parallel
  const [profileResult, rolesResult, accessResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', uid),
    supabase.from('citizen_access_controls').select('status, blocked_until').eq('user_id', uid).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const roles = rolesResult.data;
  const access = accessResult.data;

  const isAdmin = roles?.some(r => r.role === 'admin') ?? false;

  const isExpiredBlock = access?.status === 'temporarily_blocked'
    && access.blocked_until !== null
    && new Date(access.blocked_until).getTime() <= Date.now();

  const accessStatus = isExpiredBlock ? 'active' : (access?.status as User['accessStatus']) || 'active';
  const blockedUntil = isExpiredBlock ? undefined : access?.blocked_until || undefined;

  return {
    _id: uid,
    name: profile?.name || session.user.user_metadata?.name || session.user.user_metadata?.full_name || '',
    email: profile?.email || email,
    role: isAdmin ? 'admin' : 'citizen',
    phone: profile?.phone || undefined,
    avatar: profile?.avatar_url || undefined,
    createdAt: profile?.created_at || session.user.created_at,
    accessStatus,
    blockedUntil,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
  });

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          // Use setTimeout to avoid deadlock with Supabase client
          setTimeout(async () => {
            try {
              const user = await fetchUserProfile(session);
              setState({ user, isAuthenticated: true, loading: false });
            } catch {
              setState({ user: null, isAuthenticated: false, loading: false });
            }
          }, 0);
        } else {
          setState({ user: null, isAuthenticated: false, loading: false });
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const user = await fetchUserProfile(session);
          setState({ user, isAuthenticated: true, loading: false });
        } catch {
          setState({ user: null, isAuthenticated: false, loading: false });
        }
      } else {
        setState({ user: null, isAuthenticated: false, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const raw = identifier.trim();
    if (!raw) throw new Error('Email or phone number is required');

    // Case 1: Email login
    if (raw.includes('@')) {
      const { error } = await supabase.auth.signInWithPassword({
        email: raw.toLowerCase(),
        password,
      });
      if (error) throw new Error(error.message);
      return;
    }

    // Case 2: Phone login
    const cleanDigits = raw.replace(/[\s().-]/g, '');
    const normalized = cleanDigits.startsWith('+') ? cleanDigits : `+91${cleanDigits}`;

    // A. Attempt to resolve email for this phone via get_email_by_phone RPC
    try {
      const { data: emailData, error: rpcError } = await supabase.rpc('get_email_by_phone', {
        p_phone: normalized,
      });
      if (!rpcError && emailData && typeof emailData === 'string' && emailData.includes('@')) {
        const { error: emailSignInErr } = await supabase.auth.signInWithPassword({
          email: emailData.toLowerCase(),
          password,
        });
        if (!emailSignInErr) return;
      }
    } catch {
      // Proceed to direct phone sign in attempt
    }

    // B. Direct phone sign in (for native phone accounts)
    const { error: phoneErr } = await supabase.auth.signInWithPassword({
      phone: normalized,
      password,
    });
    if (!phoneErr) return;

    if (cleanDigits !== normalized) {
      const { error: rawPhoneErr } = await supabase.auth.signInWithPassword({
        phone: cleanDigits,
        password,
      });
      if (!rawPhoneErr) return;
    }

    throw new Error(phoneErr.message || 'Invalid email/phone or password');
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; phone?: string }) => {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name, phone: data.phone || '' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
    return result.session !== null;
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut();
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const user = await fetchUserProfile(session);
      setState({ user, isAuthenticated: true, loading: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
