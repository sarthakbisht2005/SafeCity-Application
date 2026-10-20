import { supabase } from '@/integrations/supabase/client';
import type { User, SOSAlert, CrimeReport, EmergencyService, Notification, DashboardStats, HeatmapPoint } from '@/types';

// Reverse geocoding using OpenStreetMap Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    if (data.display_name) {
      const parts = data.display_name.split(',').slice(0, 3).map((s: string) => s.trim());
      return parts.join(', ');
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

interface DBReportRow {
  id: string;
  user_id: string;
  profiles?: { name?: string | null } | null;
  type: string;
  title: string;
  description: string;
  location_lat: number;
  location_lng: number;
  location_address?: string | null;
  crime_location_lat?: number | null;
  crime_location_lng?: number | null;
  crime_location_address?: string | null;
  status: string;
  severity: string;
  media_names?: string[] | null;
  media_paths?: string[] | null;
  created_at: string;
  status_updates?: unknown;
  resolved_at?: string | null;
  crime_time?: string | null;
  assigned_station?: string | null;
  estimated_resolution_time?: string | null;
  admin_action?: unknown;
  authenticity_score?: number | null;
  authenticity_analysis?: unknown;
}

interface DBSOSRow {
  id: string;
  user_id: string;
  profiles?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  location_lat: number;
  location_lng: number;
  location_address?: string | null;
  status: string;
  created_at: string;
  resolved_at?: string | null;
  delivered_at?: string | null;
  acknowledged_at?: string | null;
  responder_name?: string | null;
  eta_minutes?: number | null;
}

interface DBNotificationRow {
  id: string;
  user_id?: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface DBEmergencyServiceRow {
  id: string;
  name: string;
  type: string;
  location_lat: number;
  location_lng: number;
  address: string;
  phone: string;
  distance?: number | null;
}

// Helper to map DB row to CrimeReport
function mapReport(r: DBReportRow): CrimeReport {
  return {
    _id: r.id,
    userId: r.user_id,
    userName: r.profiles?.name || 'Unknown',
    type: (r.type as CrimeReport['type']) || 'other',
    title: r.title,
    description: r.description,
    location: { lat: r.location_lat, lng: r.location_lng, address: r.location_address || undefined },
    crimeLocation: r.crime_location_lat != null ? { lat: r.crime_location_lat, lng: r.crime_location_lng, address: r.crime_location_address || undefined } : undefined,
    status: (r.status as CrimeReport['status']) || 'pending',
    severity: (r.severity as CrimeReport['severity']) || 'medium',
    mediaNames: r.media_names || undefined,
    mediaPaths: r.media_paths || undefined,
    createdAt: r.created_at,
    statusUpdates: Array.isArray(r.status_updates) ? (r.status_updates as unknown as CrimeReport['statusUpdates']) : [],
    resolvedAt: r.resolved_at || undefined,
    crimeTime: r.crime_time || undefined,
    assignedStation: r.assigned_station || undefined,
    estimatedResolutionTime: r.estimated_resolution_time || undefined,
    adminAction: r.admin_action && typeof r.admin_action === 'object' && Object.keys(r.admin_action).length ? (r.admin_action as unknown as CrimeReport['adminAction']) : undefined,
    authenticityScore: r.authenticity_score ?? undefined,
    authenticityAnalysis: r.authenticity_analysis && typeof r.authenticity_analysis === 'object' && Object.keys(r.authenticity_analysis).length ? (r.authenticity_analysis as unknown as CrimeReport['authenticityAnalysis']) : undefined,
  };
}

function mapSOSAlert(a: DBSOSRow): SOSAlert {
  return {
    _id: a.id,
    userId: a.user_id,
    userName: a.profiles?.name || 'Unknown',
    userPhone: a.profiles?.phone || undefined,
    userEmail: a.profiles?.email || undefined,
    location: { lat: a.location_lat, lng: a.location_lng, address: a.location_address || undefined },
    status: (a.status as SOSAlert['status']) || 'active',
    createdAt: a.created_at,
    resolvedAt: a.resolved_at || undefined,
    deliveredAt: a.delivered_at || undefined,
    acknowledgedAt: a.acknowledged_at || undefined,
    responderName: a.responder_name || undefined,
    etaMinutes: a.eta_minutes ?? undefined,
  };
}

function mapNotification(n: DBNotificationRow): Notification {
  return {
    _id: n.id,
    userId: n.user_id || undefined,
    type: (n.type as Notification['type']) || 'system',
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.created_at,
  };
}

function mapEmergencyService(s: DBEmergencyServiceRow): EmergencyService {
  return {
    _id: s.id,
    name: s.name,
    type: (s.type as EmergencyService['type']) || 'police',
    location: { lat: s.location_lat, lng: s.location_lng },
    address: s.address,
    phone: s.phone,
    distance: s.distance || undefined,
  };
}

export const api = {
  // =================== SOS ===================
  triggerSOS: async (location: { lat: number; lng: number }): Promise<SOSAlert> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const address = await reverseGeocode(location.lat, location.lng);
    const { data, error } = await supabase.from('sos_alerts').insert({
      user_id: session.user.id,
      location_lat: location.lat,
      location_lng: location.lng,
      location_address: address,
      status: 'active',
    }).select('*, profiles(name, phone, email)').single();

    if (error) throw new Error(error.message);

    // Create notification
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      type: 'sos',
      title: 'SOS Alert Triggered',
      message: `Emergency alert at ${address}`,
    });

    return mapSOSAlert(data);
  },

  getSOSAlerts: async (): Promise<SOSAlert[]> => {
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*, profiles(name, phone, email)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapSOSAlert);
  },

  updateSOSStatus: async (id: string, status: SOSAlert['status']): Promise<SOSAlert> => {
    const updates: { status: SOSAlert['status']; resolved_at?: string } = { status };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('sos_alerts')
      .update(updates)
      .eq('id', id)
      .select('*, profiles(name, phone, email)')
      .single();
    if (error) throw new Error(error.message);
    return mapSOSAlert(data);
  },

  updateSOSResponder: async (
    id: string,
    fields: { responderName?: string; etaMinutes?: number; status?: SOSAlert['status'] }
  ): Promise<SOSAlert> => {
    const payload: { responder_name?: string; eta_minutes?: number; status?: SOSAlert['status'] } = {};
    if (fields.responderName !== undefined) payload.responder_name = fields.responderName;
    if (fields.etaMinutes !== undefined) payload.eta_minutes = fields.etaMinutes;
    if (fields.status !== undefined) payload.status = fields.status;
    const { data, error } = await supabase
      .from('sos_alerts')
      .update(payload)
      .eq('id', id)
      .select('*, profiles(name, phone, email)')
      .single();
    if (error) throw new Error(error.message);
    return mapSOSAlert(data);
  },

  // =================== CRIME REPORTS ===================
  getCrimeReports: async (): Promise<CrimeReport[]> => {
    const { data, error } = await supabase
      .from('crime_reports')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapReport);
  },

  getUserReports: async (userId: string): Promise<CrimeReport[]> => {
    const { data, error } = await supabase
      .from('crime_reports')
      .select('*, profiles(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapReport);
  },

  submitCrimeReport: async (reportData: Partial<CrimeReport> & { mediaFiles?: File[] }): Promise<CrimeReport> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    if ((reportData.mediaFiles?.length || 0) > 5) throw new Error('A report can include up to 5 evidence files');
    const location = reportData.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
      || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) {
      throw new Error('A valid current location is required to submit a report');
    }

    const statusUpdates = [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Report submitted' }];
    const reportId = crypto.randomUUID();
    const mediaPaths: string[] = [];

    try {
      for (const file of reportData.mediaFiles || []) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${session.user.id}/${reportId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('report-evidence')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        mediaPaths.push(path);
      }
    } catch (error) {
      if (mediaPaths.length) await supabase.storage.from('report-evidence').remove(mediaPaths);
      throw error;
    }

    const { data, error } = await supabase.from('crime_reports').insert({
      id: reportId,
      user_id: session.user.id,
      type: reportData.type || 'other',
      title: reportData.title || '',
      description: reportData.description || '',
      location_lat: location.lat,
      location_lng: location.lng,
      location_address: location.address || null,
      crime_location_lat: reportData.crimeLocation?.lat ?? null,
      crime_location_lng: reportData.crimeLocation?.lng ?? null,
      crime_location_address: reportData.crimeLocation?.address || null,
      severity: reportData.severity || 'medium',
      media_names: reportData.mediaFiles?.map(file => file.name) || reportData.mediaNames || null,
      media_paths: mediaPaths,
      status_updates: statusUpdates,
      crime_time: reportData.crimeTime || new Date().toISOString(),
    }).select('*, profiles(name)').single();

    if (error) {
      if (mediaPaths.length) await supabase.storage.from('report-evidence').remove(mediaPaths);
      throw new Error(error.message);
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      type: 'crime',
      title: 'Report Submitted',
      message: `Your ${reportData.type} report "${reportData.title}" has been submitted.`,
    });

    // Fire-and-forget AI authenticity analysis (don't block UX)
    supabase.functions.invoke('detect-fake-report', { body: { reportId: data.id } })
      .then(({ data: analysisResult, error: analysisError }) => {
        if (analysisError) console.warn('detect-fake-report failed', analysisError.message);
        else if (analysisResult?.error) console.warn('detect-fake-report failed', analysisResult.error);
      })
      .catch((err) => console.warn('detect-fake-report failed', err));

    return mapReport(data);
  },

  analyzeReportAuthenticity: async (reportId: string): Promise<{
    score: number;
    analysis: NonNullable<CrimeReport['authenticityAnalysis']>;
  }> => {
    const { data, error } = await supabase.functions.invoke('detect-fake-report', {
      body: { reportId },
    });
    if (error) {
      throw new Error('AI analysis failed. Confirm detect-fake-report is deployed, GEMINI_API_KEY is set, and the latest migrations are applied.');
    }
    if (data?.error) throw new Error(data.error);
    if (typeof data?.score !== 'number' || !data.analysis) {
      throw new Error('AI analysis returned an invalid result. Check the Edge Function logs.');
    }
    return data;
  },

  updateReportStatus: async (id: string, status: CrimeReport['status'], note?: string): Promise<CrimeReport> => {
    // Get current status_updates
    const { data: current } = await supabase.from('crime_reports').select('status_updates').eq('id', id).single();
    const updates = Array.isArray(current?.status_updates) ? [...current.status_updates] : [];
    updates.push({ status, timestamp: new Date().toISOString(), note });

    const { data, error } = await supabase
      .from('crime_reports')
      .update({ status, status_updates: updates })
      .eq('id', id)
      .select('*, profiles(name)')
      .single();
    if (error) throw new Error(error.message);
    return mapReport(data);
  },

  updateReportAdmin: async (id: string, fields: { assignedStation?: string; estimatedResolutionTime?: string; adminAction?: CrimeReport['adminAction']; }): Promise<CrimeReport> => {
    const { data: { session } } = await supabase.auth.getSession();
    const payload: { assigned_station?: string; estimated_resolution_time?: string; admin_action?: CrimeReport['adminAction'] } = {};
    if (fields.assignedStation !== undefined) payload.assigned_station = fields.assignedStation;
    if (fields.estimatedResolutionTime !== undefined) payload.estimated_resolution_time = fields.estimatedResolutionTime;
    if (fields.adminAction !== undefined) payload.admin_action = { ...fields.adminAction, updatedAt: new Date().toISOString(), updatedBy: session?.user.id };
    const { data, error } = await supabase
      .from('crime_reports')
      .update(payload)
      .eq('id', id)
      .select('*, profiles(name)')
      .single();
    if (error) throw new Error(error.message);
    return mapReport(data);
  },

  // =================== HEATMAP ===================
  getHeatmapData: async (days: number | null, type: string | null): Promise<HeatmapPoint[]> => {
    const { data, error } = await supabase.rpc('get_public_crime_heatmap', {
      p_days: days,
      p_type: type,
    });
    if (error) throw new Error(error.message);

    return (data || []).map(r => ({
      lat: r.lat,
      lng: r.lng,
      intensity: r.intensity,
      type: r.report_type,
      areaName: 'Approximate area',
      incidentCount: r.incident_count,
    }));
  },

  // =================== EMERGENCY SERVICES ===================
  getEmergencyServices: async (): Promise<EmergencyService[]> => {
    const { data, error } = await supabase
      .from('emergency_services')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(mapEmergencyService);
  },

  addEmergencyService: async (serviceData: Omit<EmergencyService, '_id'>): Promise<EmergencyService> => {
    const { data, error } = await supabase.from('emergency_services').insert({
      name: serviceData.name,
      type: serviceData.type,
      location_lat: serviceData.location.lat,
      location_lng: serviceData.location.lng,
      address: serviceData.address,
      phone: serviceData.phone,
      distance: serviceData.distance || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return mapEmergencyService(data);
  },

  deleteEmergencyService: async (id: string): Promise<void> => {
    const { error } = await supabase.from('emergency_services').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // =================== NOTIFICATIONS ===================
  getNotifications: async (): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapNotification);
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },

  markAllNotificationsRead: async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id).eq('read', false);
  },

  // =================== DASHBOARD ===================
  getDashboardStats: async (): Promise<DashboardStats> => {
    const [reportsResult, alertsResult] = await Promise.all([
      supabase.from('crime_reports').select('type, status, severity, created_at'),
      supabase.from('sos_alerts').select('status'),
    ]);
    if (reportsResult.error) throw new Error(reportsResult.error.message);
    if (alertsResult.error) throw new Error(alertsResult.error.message);

    const allReports = reportsResult.data || [];
    const allAlerts = alertsResult.data || [];

    const totalReports = allReports.length;
    const activeAlerts = allAlerts.filter(a => a.status === 'active').length;
    const resolvedCases = allReports.filter(r => r.status === 'resolved').length + allAlerts.filter(a => a.status === 'resolved').length;
    const pendingReports = allReports.filter(r => r.status === 'pending').length;

    const typeCounts: Record<string, number> = {};
    allReports.forEach(r => {
      const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    const reportsByType = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

    const monthCounts: Record<string, number> = {};
    allReports.forEach(r => {
      const d = new Date(r.created_at);
      const month = d.toLocaleString('en', { month: 'short' });
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const reportsByMonth = Object.entries(monthCounts).map(([month, count]) => ({ month, count }));

    const sevCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
    allReports.forEach(r => {
      const label = r.severity ? r.severity.charAt(0).toUpperCase() + r.severity.slice(1) : 'Medium';
      sevCounts[label] = (sevCounts[label] || 0) + 1;
    });
    const severityDistribution = Object.entries(sevCounts).map(([severity, count]) => ({ severity, count }));

    return { totalReports, activeAlerts, resolvedCases, pendingReports, reportsByType, reportsByMonth, severityDistribution };
  },

  // =================== USERS (admin) ===================
  getUsers: async (): Promise<User[]> => {
    const [profilesResult, rolesResult, accessResult] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('citizen_access_controls').select('user_id, status, blocked_until'),
    ]);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (rolesResult.error) throw new Error(rolesResult.error.message);
    if (accessResult.error) {
      console.warn('Citizen access controls table query notice:', accessResult.error.message);
    }

    const profiles = profilesResult.data || [];
    const roles = rolesResult.data || [];
    const accessControls = accessResult.data || [];

    return (profiles || []).map(p => {
      const userRoles = roles.filter(r => r.user_id === p.id);
      const isAdmin = userRoles.some(r => r.role === 'admin');
      const access = accessControls.find(entry => entry.user_id === p.id);
      const isExpiredBlock = access?.status === 'temporarily_blocked'
        && access.blocked_until !== null
        && new Date(access.blocked_until).getTime() <= Date.now();
      return {
        _id: p.id,
        name: p.name,
        email: p.email,
        role: isAdmin ? 'admin' as const : 'citizen' as const,
        phone: p.phone || undefined,
        avatar: p.avatar_url || undefined,
        createdAt: p.created_at,
        accessStatus: isExpiredBlock ? 'active' : access?.status as User['accessStatus'] || 'active',
        blockedUntil: isExpiredBlock ? undefined : access?.blocked_until || undefined,
      };
    });
  },

  manageCitizenAccess: async (
    userId: string,
    action: 'temporary_block' | 'blacklist' | 'whitelist' | 'delete',
    durationHours?: number,
  ): Promise<{ status: string; blockedUntil?: string | null; cleanupWarnings?: string[] }> => {
    // 1. Try via Edge Function first
    let edgeException: unknown = null;
    try {
      const { data, error } = await supabase.functions.invoke('manage-citizen', {
        body: { userId, action, durationHours },
      });
      if (!error && data && !data.error) {
        return data as { status: string; blockedUntil?: string | null; cleanupWarnings?: string[] };
      }
      if (data?.error) {
        if (data.error.includes('Admin accounts')) throw new Error(data.error);
        edgeException = new Error(data.error);
      }
      if (error) {
        let message = error.message;
        if (error.context instanceof Response) {
          try {
            const body = await error.context.clone().json();
            if (typeof body?.error === 'string') message = body.error;
          } catch {
            // Keep original message
          }
        }
        edgeException = new Error(message);
      }
    } catch (err) {
      edgeException = err;
      console.warn('Edge function manage-citizen unavailable, falling back to database RPC/tables:', err);
    }

    // 2. Resilient fallback via Database RPC and direct database updates
    if (action === 'delete') {
      const { error: rpcError } = await supabase.rpc('admin_delete_citizen', {
        target_user_id: userId,
      });
      if (!rpcError) {
        return { status: 'deleted', cleanupWarnings: [] };
      }
      // If RPC is unavailable, attempt direct profile deletion (cascades or admin policy)
      const { error: delError } = await supabase.from('profiles').delete().eq('id', userId);
      if (!delError) {
        return { status: 'deleted', cleanupWarnings: [] };
      }
      const finalMsg = edgeException instanceof Error ? edgeException.message : (rpcError?.message || delError.message);
      throw new Error(finalMsg || 'Failed to delete citizen account');
    }

    const statusMap = {
      temporary_block: 'temporarily_blocked',
      blacklist: 'blacklisted',
      whitelist: 'active',
    } as const;
    const targetStatus = statusMap[action];

    // Try RPC first
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('admin_set_citizen_access', {
      target_user_id: userId,
      new_status: targetStatus,
      duration_hours: action === 'temporary_block' ? (durationHours || 24) : null,
    });

    if (!rpcErr && rpcResult && typeof rpcResult === 'object') {
      const parsed = rpcResult as { status?: string; blockedUntil?: string | null };
      return {
        status: parsed.status || targetStatus,
        blockedUntil: parsed.blockedUntil,
      };
    }

    // Direct table upsert fallback
    let blockedUntil: string | null = null;
    if (action === 'temporary_block') {
      const hours = durationHours || 24;
      blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error: upsertErr } = await supabase.from('citizen_access_controls').upsert({
      user_id: userId,
      status: targetStatus,
      blocked_until: blockedUntil,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      const errMsg = edgeException instanceof Error ? edgeException.message : (rpcErr?.message || upsertErr.message);
      throw new Error(errMsg);
    }

    return { status: targetStatus, blockedUntil };
  },

  updateCitizenProfile: async (userId: string, fields: { name: string; phone: string }): Promise<void> => {
    const { error } = await supabase.from('profiles').update({
      name: fields.name.trim(),
      phone: fields.phone.trim() || null,
    }).eq('id', userId);
    if (error) throw new Error(error.message);
  },
};
