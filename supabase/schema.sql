-- ==============================================================================
-- MY SAFE CITY - COMPLETE CONSOLIDATED DATABASE SCHEMA
-- All migrations merged into a single comprehensive, clean, and runnable file.
-- Compatible with Supabase SQL Editor and Supabase CLI.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & CUSTOM TYPES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'citizen');
  END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- 2. CORE TABLES
-- ------------------------------------------------------------------------------

-- PROFILES (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES (RBAC: citizen or admin)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'citizen',
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- CITIZEN ACCESS CONTROLS (Account security: active, temporarily_blocked, blacklisted)
CREATE TABLE IF NOT EXISTS public.citizen_access_controls (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'temporarily_blocked', 'blacklisted')),
  blocked_until TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'temporarily_blocked' AND blocked_until IS NOT NULL)
    OR (status <> 'temporarily_blocked' AND blocked_until IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_citizen_access_controls_status ON public.citizen_access_controls(status);

-- CRIME REPORTS
CREATE TABLE IF NOT EXISTS public.crime_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  location_address TEXT,
  crime_location_lat DOUBLE PRECISION,
  crime_location_lng DOUBLE PRECISION,
  crime_location_address TEXT,
  crime_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  severity TEXT NOT NULL DEFAULT 'medium',
  media_names TEXT[],
  media_paths TEXT[] NOT NULL DEFAULT '{}',
  status_updates JSONB DEFAULT '[]'::jsonb,
  assigned_station TEXT,
  estimated_resolution_time TEXT,
  admin_action JSONB DEFAULT '{}'::jsonb,
  authenticity_score INTEGER,
  authenticity_analysis JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crime_reports_user_id ON public.crime_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_crime_reports_status ON public.crime_reports(status);
CREATE INDEX IF NOT EXISTS idx_crime_reports_created_at ON public.crime_reports(created_at DESC);

-- SOS ALERTS (Emergency dispatch alerts)
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  location_address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  delivered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  responder_name TEXT,
  eta_minutes INTEGER,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_id ON public.sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON public.sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_created_at ON public.sos_alerts(created_at DESC);

-- NOTIFICATIONS (Push and in-app system notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- EMERGENCY SERVICES (Police stations, hospitals, fire departments)
CREATE TABLE IF NOT EXISTS public.emergency_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'police',
  location_lat DOUBLE PRECISION NOT NULL DEFAULT 30.3165,
  location_lng DOUBLE PRECISION NOT NULL DEFAULT 78.0322,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  distance DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHAT MESSAGES (AI safety assistant conversations)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages (user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. STORAGE BUCKETS SETUP
-- ------------------------------------------------------------------------------

-- Public Avatars Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Private Report Evidence Bucket (Strict size & MIME validation)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-evidence',
  'report-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS & PROCEDURES
-- ------------------------------------------------------------------------------

-- Check if a user has a specific role (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Check if a citizen account is active (not blacklisted or in an active temporary block)
CREATE OR REPLACE FUNCTION public.is_citizen_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.citizen_access_controls
    WHERE user_id = _user_id
      AND (
        status = 'blacklisted'
        OR (status = 'temporarily_blocked' AND (blocked_until IS NULL OR blocked_until > now()))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.is_citizen_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_citizen_active(UUID) TO authenticated;

-- Trigger function: Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Trigger function: Auto-create profile and citizen role on new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'preferred_username', ''),
      ''
    ),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.phone, ''), NULLIF(NEW.raw_user_meta_data->>'phone', ''))
  )
  ON CONFLICT (id) DO UPDATE SET
    name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE public.profiles.name END,
    email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE public.profiles.email END,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Trigger function: Auto-set resolved_at when a crime report status changes to 'resolved'
CREATE OR REPLACE FUNCTION public.set_resolved_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_resolved_at() FROM anon, authenticated, public;

-- Trigger function: Guard administrative fields on crime_reports against citizen modifications
CREATE OR REPLACE FUNCTION public.prevent_citizen_admin_field_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_action IS DISTINCT FROM OLD.admin_action
     OR NEW.assigned_station IS DISTINCT FROM OLD.assigned_station
     OR NEW.estimated_resolution_time IS DISTINCT FROM OLD.estimated_resolution_time
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
  THEN
    RAISE EXCEPTION 'Only admins can modify status, admin_action, assigned_station, estimated_resolution_time, or resolved_at';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_citizen_admin_field_writes() FROM anon, authenticated, public;

-- Trigger function: Auto-stamp responder timestamps on sos_alerts
CREATE OR REPLACE FUNCTION public.set_sos_acknowledged_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'responding' AND (OLD.status IS DISTINCT FROM 'responding') AND NEW.acknowledged_at IS NULL THEN
    NEW.acknowledged_at = now();
  END IF;
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_sos_acknowledged_at() FROM anon, authenticated, public;

-- Analytical RPC: Aggregated public crime heatmap coordinates and incident counts
CREATE OR REPLACE FUNCTION public.get_public_crime_heatmap(p_days integer DEFAULT NULL, p_type text DEFAULT NULL)
RETURNS TABLE(lat double precision, lng double precision, report_type text, incident_count bigint, intensity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    round(COALESCE(crime_location_lat, location_lat)::numeric, 2)::double precision AS lat,
    round(COALESCE(crime_location_lng, location_lng)::numeric, 2)::double precision AS lng,
    type AS report_type,
    count(*) AS incident_count,
    LEAST(0.9, GREATEST(0.3, avg(CASE severity WHEN 'high' THEN 0.9 WHEN 'medium' THEN 0.6 ELSE 0.3 END)))::double precision AS intensity
  FROM public.crime_reports
  WHERE status <> 'rejected'
    AND (
      p_days IS NULL
      OR (p_days = 7 AND created_at >= now() - interval '7 days')
      OR (p_days = 30 AND created_at >= now() - interval '30 days')
    )
    AND (p_type IS NULL OR type = p_type)
  GROUP BY 1, 2, 3
$$;

-- Admin RPC: Set citizen access controls (whitelist, temporary block, blacklist)
CREATE OR REPLACE FUNCTION public.admin_set_citizen_access(
  target_user_id UUID,
  new_status TEXT,
  duration_hours INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked_until TIMESTAMPTZ := NULL;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can manage citizen access.';
  END IF;

  IF public.has_role(target_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Cannot restrict administrator accounts.';
  END IF;

  IF new_status NOT IN ('active', 'temporarily_blocked', 'blacklisted') THEN
    RAISE EXCEPTION 'Invalid status. Must be active, temporarily_blocked, or blacklisted.';
  END IF;

  IF new_status = 'temporarily_blocked' THEN
    IF duration_hours IS NULL OR duration_hours <= 0 THEN
      duration_hours := 24;
    END IF;
    v_blocked_until := now() + (duration_hours || ' hours')::interval;
  END IF;

  INSERT INTO public.citizen_access_controls (user_id, status, blocked_until, updated_by, updated_at)
  VALUES (target_user_id, new_status, v_blocked_until, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    blocked_until = EXCLUDED.blocked_until,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'status', new_status,
    'blockedUntil', v_blocked_until
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_citizen_access(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_citizen_access(UUID, TEXT, INT) TO authenticated;

-- Admin RPC: Permanently delete citizen account and cascade cleanups
CREATE OR REPLACE FUNCTION public.admin_delete_citizen(
  target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can delete citizens.';
  END IF;

  IF public.has_role(target_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Cannot delete administrator accounts.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('status', 'deleted');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_citizen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_citizen(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. DATABASE TRIGGERS
-- ------------------------------------------------------------------------------

-- Trigger on auth.users for profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crime_reports_updated_at ON public.crime_reports;
CREATE TRIGGER update_crime_reports_updated_at
  BEFORE UPDATE ON public.crime_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Crime reports status resolution trigger
DROP TRIGGER IF EXISTS trg_set_resolved_at ON public.crime_reports;
CREATE TRIGGER trg_set_resolved_at
  BEFORE UPDATE ON public.crime_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_resolved_at();

-- Crime reports admin fields guard trigger
DROP TRIGGER IF EXISTS guard_admin_fields ON public.crime_reports;
CREATE TRIGGER guard_admin_fields
  BEFORE UPDATE ON public.crime_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_citizen_admin_field_writes();

-- SOS alerts acknowledgment trigger
DROP TRIGGER IF EXISTS sos_acknowledged_trigger ON public.sos_alerts;
CREATE TRIGGER sos_acknowledged_trigger
  BEFORE UPDATE ON public.sos_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sos_acknowledged_at();

-- ------------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_access_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only system can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "System inserts profiles" ON public.profiles;
CREATE POLICY "Only system can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can update citizen profiles" ON public.profiles;
CREATE POLICY "Admins can update citizen profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT public.has_role(id, 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT public.has_role(id, 'admin'::public.app_role)
  );

-- USER_ROLES POLICIES
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
CREATE POLICY "Admins can view roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- CITIZEN_ACCESS_CONTROLS POLICIES
DROP POLICY IF EXISTS "Users can view own access control status or admin views all" ON public.citizen_access_controls;
DROP POLICY IF EXISTS "Admins can view citizen access controls" ON public.citizen_access_controls;
DROP POLICY IF EXISTS "Users can view own access control status" ON public.citizen_access_controls;
CREATE POLICY "Users can view own access control status or admin views all"
  ON public.citizen_access_controls FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert citizen access controls" ON public.citizen_access_controls;
CREATE POLICY "Admins can insert citizen access controls"
  ON public.citizen_access_controls FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update citizen access controls" ON public.citizen_access_controls;
CREATE POLICY "Admins can update citizen access controls"
  ON public.citizen_access_controls FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete citizen access controls" ON public.citizen_access_controls;
CREATE POLICY "Admins can delete citizen access controls"
  ON public.citizen_access_controls FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- CRIME_REPORTS POLICIES
DROP POLICY IF EXISTS "Report owners and admins can view reports" ON public.crime_reports;
DROP POLICY IF EXISTS "All authenticated users can view reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Users can view own reports or admin views all" ON public.crime_reports;
CREATE POLICY "Report owners and admins can view reports"
  ON public.crime_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can submit pending reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.crime_reports;
CREATE POLICY "Users can submit pending reports"
  ON public.crime_reports FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND location_lat BETWEEN -90 AND 90
    AND location_lng BETWEEN -180 AND 180
    AND (crime_location_lat IS NULL OR crime_location_lat BETWEEN -90 AND 90)
    AND (crime_location_lng IS NULL OR crime_location_lng BETWEEN -180 AND 180)
    AND resolved_at IS NULL
    AND assigned_station IS NULL
    AND estimated_resolution_time IS NULL
    AND authenticity_score IS NULL
    AND (admin_action IS NULL OR admin_action = '{}'::jsonb)
    AND (authenticity_analysis IS NULL OR authenticity_analysis = '{}'::jsonb)
    AND created_at <= now()
    AND public.is_citizen_active(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Owners or admins can update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Users can update own reports or admin updates all" ON public.crime_reports;
CREATE POLICY "Admins can update reports"
  ON public.crime_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Users can delete own reports or admin deletes all" ON public.crime_reports;
CREATE POLICY "Admins can delete reports"
  ON public.crime_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- SOS_ALERTS POLICIES
DROP POLICY IF EXISTS "Users can view own alerts or admin views all" ON public.sos_alerts;
CREATE POLICY "Users can view own alerts or admin views all"
  ON public.sos_alerts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can create active SOS alerts" ON public.sos_alerts;
DROP POLICY IF EXISTS "Users can create alerts" ON public.sos_alerts;
CREATE POLICY "Users can create active SOS alerts"
  ON public.sos_alerts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'active'
    AND responder_name IS NULL
    AND eta_minutes IS NULL
    AND acknowledged_at IS NULL
    AND resolved_at IS NULL
    AND public.is_citizen_active(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update SOS alerts" ON public.sos_alerts;
DROP POLICY IF EXISTS "Users can update own alerts or admin updates all" ON public.sos_alerts;
CREATE POLICY "Admins can update SOS alerts"
  ON public.sos_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users create own notifications or admins create any" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users create own notifications or admins create any"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- EMERGENCY_SERVICES POLICIES
DROP POLICY IF EXISTS "Anyone can view emergency services" ON public.emergency_services;
CREATE POLICY "Anyone can view emergency services"
  ON public.emergency_services FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can add services" ON public.emergency_services;
CREATE POLICY "Admins can add services"
  ON public.emergency_services FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update services" ON public.emergency_services;
CREATE POLICY "Admins can update services"
  ON public.emergency_services FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete services" ON public.emergency_services;
CREATE POLICY "Admins can delete services"
  ON public.emergency_services FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- CHAT_MESSAGES POLICIES
DROP POLICY IF EXISTS "Users view own chats or admin views all" ON public.chat_messages;
CREATE POLICY "Users view own chats or admin views all"
  ON public.chat_messages FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users create own chats" ON public.chat_messages;
CREATE POLICY "Users create own chats"
  ON public.chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own chats" ON public.chat_messages;
CREATE POLICY "Users delete own chats"
  ON public.chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- STORAGE OBJECTS POLICIES
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Report evidence owners and admins can read" ON storage.objects;
CREATE POLICY "Report evidence owners and admins can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Users can upload own report evidence" ON storage.objects;
CREATE POLICY "Users can upload own report evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_citizen_active(auth.uid())
  );

DROP POLICY IF EXISTS "Report evidence owners and admins can delete" ON storage.objects;
CREATE POLICY "Report evidence owners and admins can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- ------------------------------------------------------------------------------
-- 7. REALTIME PUBLICATIONS SETUP
-- ------------------------------------------------------------------------------
ALTER TABLE public.crime_reports REPLICA IDENTITY FULL;
ALTER TABLE public.sos_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crime_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;
