import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, AlertTriangle, FileText, TrendingUp, CheckCircle, Clock, XCircle, Eye, Shield, Activity, MapPin, Zap, User, Calendar, Tag, Plus, Trash2, Building2, Phone, Users, Mail, ShieldAlert, ShieldCheck, Pencil, Search, ShieldBan, Unlock, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { SOSAlert, CrimeReport, DashboardStats, EmergencyService, User as UserType } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import EvidenceFiles from '@/components/EvidenceFiles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const PIE_COLORS = ['hsl(145, 65%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 90%, 50%)'];
const CHART_BLUE = 'hsl(220, 70%, 55%)';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0, 0, 0.2, 1] as const } }),
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const SERVICE_TYPES = ['police', 'hospital', 'fire'] as const;
const SERVICE_ICONS: Record<string, string> = { police: '🚔', hospital: '🏥', fire: '🚒' };

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [services, setServices] = useState<EmergencyService[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [tab, setTab] = useState<'overview' | 'alerts' | 'reports' | 'services' | 'users'>('overview');
  const [selectedReport, setSelectedReport] = useState<CrimeReport | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SOSAlert | null>(null);
  const [editingCitizen, setEditingCitizen] = useState<UserType | null>(null);
  const [citizenForm, setCitizenForm] = useState({ name: '', phone: '' });
  const [savingCitizen, setSavingCitizen] = useState(false);
  const [savingAccessAction, setSavingAccessAction] = useState(false);
  const [blockDurationHours, setBlockDurationHours] = useState(24);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [analyzingReport, setAnalyzingReport] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'citizen' | 'admin'>('all');
  const [userAccessFilter, setUserAccessFilter] = useState<'all' | 'active' | 'temporarily_blocked' | 'blacklisted'>('all');

  const [newService, setNewService] = useState({ name: '', type: 'police' as EmergencyService['type'], address: '', phone: '', lat: '', lng: '' });
  const [adminEdit, setAdminEdit] = useState({ assignedStation: '', estimatedResolutionTime: '', action: '', note: '' });
  const [sosEdit, setSosEdit] = useState({ responderName: '', etaMinutes: '' });

  const fetchData = async () => {
    const results = await Promise.allSettled([
      api.getDashboardStats(),
      api.getSOSAlerts(),
      api.getCrimeReports(),
      api.getEmergencyServices(),
      api.getUsers(),
    ]);
    const [statsResult, alertsResult, reportsResult, servicesResult, usersResult] = results;
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value);
    if (reportsResult.status === 'fulfilled') setReports(reportsResult.value);
    if (servicesResult.status === 'fulfilled') setServices(servicesResult.value);
    if (usersResult.status === 'fulfilled') setAllUsers(usersResult.value);
    setLoadError(results.some(result => result.status === 'rejected')
      ? 'Some dashboard data could not be loaded. Check the connection and retry.'
      : '');
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') { navigate(isAuthenticated ? '/' : '/login'); return; }
    void fetchData();
    const interval = setInterval(() => void fetchData(), 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user, navigate]);

  // Sync admin edit form when selected report changes
  useEffect(() => {
    if (selectedReport) {
      setAdminEdit({
        assignedStation: selectedReport.assignedStation || '',
        estimatedResolutionTime: selectedReport.estimatedResolutionTime || '',
        action: selectedReport.adminAction?.action || '',
        note: selectedReport.adminAction?.note || '',
      });
    }
  }, [selectedReport]);

  const saveAdminAction = async () => {
    if (!selectedReport) return;
    try {
      const updated = await api.updateReportAdmin(selectedReport._id, {
        assignedStation: adminEdit.assignedStation || undefined,
        estimatedResolutionTime: adminEdit.estimatedResolutionTime || undefined,
        adminAction: { action: adminEdit.action, note: adminEdit.note },
      });
      toast.success('Admin action saved');
      setSelectedReport(updated);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const analyzeSelectedReport = async () => {
    if (!selectedReport || analyzingReport) return;
    setAnalyzingReport(true);
    try {
      const result = await api.analyzeReportAuthenticity(selectedReport._id);
      const updatedReport = {
        ...selectedReport,
        authenticityScore: result.score,
        authenticityAnalysis: result.analysis,
      };
      setSelectedReport(updatedReport);
      setReports(current => current.map(report => report._id === updatedReport._id ? updatedReport : report));
      toast.success('AI authenticity analysis completed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI analysis failed');
    } finally {
      setAnalyzingReport(false);
    }
  };

  const openCitizenEditor = (citizen: UserType) => {
    setCitizenForm({ name: citizen.name, phone: citizen.phone || '' });
    setBlockDurationHours(24);
    setDeleteConfirmation('');
    setEditingCitizen(citizen);
  };

  const saveCitizenProfile = async () => {
    if (!editingCitizen || !citizenForm.name.trim() || savingCitizen) return;
    setSavingCitizen(true);
    try {
      await api.updateCitizenProfile(editingCitizen._id, citizenForm);
      const updatedCitizen = {
        ...editingCitizen,
        name: citizenForm.name.trim(),
        phone: citizenForm.phone.trim() || undefined,
      };
      setAllUsers(current => current.map(citizen => citizen._id === updatedCitizen._id ? updatedCitizen : citizen));
      setEditingCitizen(null);
      toast.success('Citizen profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update citizen profile');
    } finally {
      setSavingCitizen(false);
    }
  };

  const performCitizenAccessAction = async (action: 'temporary_block' | 'blacklist' | 'whitelist' | 'delete') => {
    if (!editingCitizen || savingAccessAction || (action === 'delete' && deleteConfirmation !== 'DELETE')) return;
    setSavingAccessAction(true);
    try {
      const result = await api.manageCitizenAccess(editingCitizen._id, action, blockDurationHours);
      if (action === 'delete') {
        setAllUsers(current => current.filter(citizen => citizen._id !== editingCitizen._id));
        setEditingCitizen(null);
        setDeleteConfirmation('');
        toast.success('Citizen permanently deleted');
        if (result.cleanupWarnings?.length) toast.warning(result.cleanupWarnings.join('. '));
        return;
      }

      const updatedCitizen = {
        ...editingCitizen,
        accessStatus: result.status as UserType['accessStatus'],
        blockedUntil: result.blockedUntil || undefined,
      };
      setAllUsers(current => current.map(citizen => citizen._id === updatedCitizen._id ? updatedCitizen : citizen));
      setEditingCitizen(updatedCitizen);
      setDeleteConfirmation('');
      toast.success(action === 'whitelist' ? 'Citizen access restored' : action === 'blacklist' ? 'Citizen blacklisted' : 'Citizen temporarily blocked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change citizen access');
    } finally {
      setSavingAccessAction(false);
    }
  };

  const handleQuickWhitelist = async (citizen: UserType, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await api.manageCitizenAccess(citizen._id, 'whitelist');
      const updatedCitizen = {
        ...citizen,
        accessStatus: result.status as UserType['accessStatus'],
        blockedUntil: undefined,
      };
      setAllUsers(current => current.map(u => u._id === updatedCitizen._id ? updatedCitizen : u));
      if (editingCitizen?._id === citizen._id) {
        setEditingCitizen(updatedCitizen);
      }
      toast.success(`Access restored for ${citizen.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to restore citizen access');
    }
  };

  const handleReportAction = async (id: string, action: CrimeReport['status'], note?: string) => {
    try {
      await api.updateReportStatus(id, action, note || `Report ${action} by admin`);
      void fetchData();
      toast.success(`Report ${action}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update report');
    }
  };

  const handleAlertAction = async (id: string, status: SOSAlert['status']) => {
    try {
      await api.updateSOSStatus(id, status);
      void fetchData();
      toast.success(`Alert ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update alert');
    }
  };

  const saveSosResponder = async () => {
    if (!selectedAlert) return;
    try {
      const updated = await api.updateSOSResponder(selectedAlert._id, {
        responderName: sosEdit.responderName || undefined,
        etaMinutes: sosEdit.etaMinutes ? parseInt(sosEdit.etaMinutes, 10) : undefined,
        status: selectedAlert.status === 'active' ? 'responding' : selectedAlert.status,
      });
      toast.success('Responder details saved');
      setSelectedAlert(updated);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  // Sync SOS responder form when an alert is selected
  useEffect(() => {
    if (selectedAlert) {
      setSosEdit({
        responderName: selectedAlert.responderName || '',
        etaMinutes: selectedAlert.etaMinutes != null ? String(selectedAlert.etaMinutes) : '',
      });
    }
  }, [selectedAlert]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.address || !newService.phone) { toast.error('Please fill all required fields'); return; }
    const lat = Number(newService.lat);
    const lng = Number(newService.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      toast.error('Enter valid latitude and longitude values');
      return;
    }
    try {
      await api.addEmergencyService({
        name: newService.name.trim(), type: newService.type, address: newService.address.trim(), phone: newService.phone.trim(),
        location: { lat, lng },
      });
      setNewService({ name: '', type: 'police', address: '', phone: '', lat: '', lng: '' });
      void fetchData();
      toast.success('Emergency service added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add emergency service');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await api.deleteEmergencyService(id);
      void fetchData();
      toast.success('Service removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove service');
    }
  };

  if (!stats) return (
    <div className="min-h-screen flex items-center justify-center">
      {loadError ? (
        <div role="alert" className="text-center">
          <p className="text-destructive mb-3">{loadError}</p>
          <button onClick={() => void fetchData()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Retry</button>
        </div>
      ) : (
        <>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
        </>
      )}
    </div>
  );

  const statCards = [
    { label: 'Total Reports', value: stats.totalReports, icon: FileText, color: 'text-primary', bgGrad: 'from-primary/10 to-primary/5' },
    { label: 'Active Alerts', value: stats.activeAlerts, icon: AlertTriangle, color: 'text-emergency', bgGrad: 'from-emergency/10 to-emergency/5' },
    { label: 'Resolved Cases', value: stats.resolvedCases, icon: CheckCircle, color: 'text-success', bgGrad: 'from-success/10 to-success/5' },
    { label: 'Total Users', value: allUsers.filter(u => u.role === 'citizen').length, icon: Users, color: 'text-warning', bgGrad: 'from-warning/10 to-warning/5' },
  ];

  const resolutionRate = stats.totalReports > 0 ? Math.round((stats.resolvedCases / stats.totalReports) * 100) : 0;

  return (
    <div className="min-h-screen py-8 pb-28 sm:pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" className="mb-8">
          <motion.div variants={fadeUp} custom={0} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Command Center</h1>
              <p className="text-muted-foreground text-sm sm:text-base">City safety overview · Dehradun</p>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Activity className="w-4 h-4" /> Refreshes every 30 seconds
            </div>
          </motion.div>
        </motion.div>

        {/* Stat Cards */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {statCards.map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i + 1} className={`stat-card p-4 sm:p-6 bg-gradient-to-br ${s.bgGrad}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">{s.value.toLocaleString()}</div>
            </motion.div>
          ))}
        </motion.div>

        {loadError && <p role="alert" className="text-sm text-destructive mb-4">{loadError}</p>}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto bg-secondary/50 p-1 rounded-xl">
          {(['overview', 'alerts', 'reports', 'services', 'users'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 whitespace-nowrap ${
                tab === t ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
              }`}>
              {t === 'users' ? 'Citizens & Users' : t}
              {t === 'alerts' && alerts.filter(a => a.status === 'active').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emergency text-emergency-foreground rounded-full text-xs flex items-center justify-center">
                  {alerts.filter(a => a.status === 'active').length}
                </span>
              )}
              {t === 'users' && allUsers.filter(u => u.accessStatus === 'temporarily_blocked' || u.accessStatus === 'blacklisted').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-warning-foreground rounded-full text-xs flex items-center justify-center font-bold" title="Citizens with restricted access">
                  {allUsers.filter(u => u.accessStatus === 'temporarily_blocked' || u.accessStatus === 'blacklisted').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Reports by Type</h3>
              <p className="text-sm text-muted-foreground mb-4">Crime category breakdown</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.reportsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Severity</h3>
              <p className="text-sm text-muted-foreground mb-4">Distribution breakdown</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.severityDistribution} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {stats.severityDistribution.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {stats.severityDistribution.map((s, i) => (
                  <div key={s.severity} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    {s.severity} <span className="text-muted-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Area Chart */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Monthly Trend</h3>
              <p className="text-sm text-muted-foreground mb-4">Report volume over time</p>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.reportsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke={CHART_BLUE} fill={CHART_BLUE} fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Resolution Rate */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Resolution Rate</h3>
              <p className="text-sm text-muted-foreground mb-4">Case closure performance</p>
              <div className="text-center py-8">
                <div className="text-5xl font-bold text-primary mb-2">{resolutionRate}%</div>
                <div className="text-muted-foreground">resolved</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div><div className="text-xl font-bold">{stats.totalReports}</div><div className="text-sm text-muted-foreground">Total</div></div>
                <div><div className="text-xl font-bold text-success">{stats.resolvedCases}</div><div className="text-sm text-muted-foreground">Resolved</div></div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card rounded-2xl p-6 lg:col-span-2">
              <h3 className="font-semibold mb-1">Recent Activity</h3>
              <p className="text-sm text-muted-foreground mb-4">Latest reports and alerts</p>
              <div className="space-y-3">
                {reports.slice(0, 3).map((r, i) => (
                  <div key={r._id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.type} · {r.location.address}</p>
                    </div>
                    <span className="text-xs capitalize font-medium">{r.status}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 && <div className="text-center py-20 text-muted-foreground">No alerts</div>}
            {alerts.map((a, i) => (
              <motion.div key={a._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedAlert(a)}
                className="glass-card-hover rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 sm:mt-0 ${a.status === 'active' ? 'text-emergency animate-pulse' : a.status === 'responding' ? 'text-warning' : 'text-success'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base">{a.userName}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{a.location.address} · {new Date(a.createdAt).toLocaleString()}</p>
                    {a.userPhone && <p className="text-xs text-muted-foreground mt-0.5"><Phone className="w-3 h-3 inline mr-1" />{a.userPhone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                    a.status === 'active' ? 'bg-emergency/10 text-emergency' : a.status === 'responding' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                  }`}>{a.status}</span>
                  <div onClick={e => e.stopPropagation()} className="flex gap-2">
                    {a.status === 'active' && (
                      <button onClick={() => handleAlertAction(a._id, 'responding')} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-all active:scale-95">Respond</button>
                    )}
                    {a.status === 'responding' && (
                      <button onClick={() => handleAlertAction(a._id, 'resolved')} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-success text-success-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-all active:scale-95">Resolve</button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* SOS Alert Detail Dialog */}
            <Dialog open={!!selectedAlert} onOpenChange={open => !open && setSelectedAlert(null)}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                {selectedAlert && (
                  <>
                    <DialogHeader>
                      <DialogTitle>SOS Alert Details</DialogTitle>
                      <DialogDescription>Emergency alert information</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <div><span className="text-muted-foreground">User Name</span><p className="font-medium">{selectedAlert.userName}</p></div>
                      <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{selectedAlert.status}</p></div>
                      {selectedAlert.userPhone && <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{selectedAlert.userPhone}</p></div>}
                      {selectedAlert.userEmail && <div><span className="text-muted-foreground">Email</span><p className="font-medium">{selectedAlert.userEmail}</p></div>}
                      <div><span className="text-muted-foreground">Location</span><p className="font-medium">{selectedAlert.location.address || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">Lat: {selectedAlert.location.lat.toFixed(4)}, Lng: {selectedAlert.location.lng.toFixed(4)}</p></div>
                      <div><span className="text-muted-foreground">Triggered At</span><p className="font-medium">{new Date(selectedAlert.createdAt).toLocaleString()}</p></div>
                      {selectedAlert.deliveredAt && <div><span className="text-muted-foreground">Delivered At</span><p className="font-medium">{new Date(selectedAlert.deliveredAt).toLocaleString()}</p></div>}
                      {selectedAlert.acknowledgedAt && <div><span className="text-muted-foreground">Acknowledged At</span><p className="font-medium">{new Date(selectedAlert.acknowledgedAt).toLocaleString()}</p></div>}
                      {selectedAlert.resolvedAt && <div><span className="text-muted-foreground">Resolved At</span><p className="font-medium">{new Date(selectedAlert.resolvedAt).toLocaleString()}</p></div>}
                    </div>

                    {selectedAlert.status !== 'resolved' && (
                      <div className="mt-4 p-3 rounded-xl border border-border space-y-3">
                        <p className="text-sm font-semibold">Dispatch Responder</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Responder name (e.g. Unit 12)"
                            value={sosEdit.responderName}
                            onChange={e => setSosEdit(s => ({ ...s, responderName: e.target.value }))}
                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                          />
                          <input
                            type="number"
                            min={1}
                            max={240}
                            placeholder="ETA (minutes)"
                            value={sosEdit.etaMinutes}
                            onChange={e => setSosEdit(s => ({ ...s, etaMinutes: e.target.value }))}
                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                          />
                        </div>
                        <button
                          onClick={saveSosResponder}
                          className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
                        >
                          Save & Mark Responding
                        </button>
                      </div>
                    )}

                    {selectedAlert.status !== 'resolved' && (
                      <div className="flex gap-3 mt-4">
                        {selectedAlert.status === 'active' && (
                          <button onClick={() => { handleAlertAction(selectedAlert._id, 'responding'); setSelectedAlert(null); }}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Respond</button>
                        )}
                        <button onClick={() => { handleAlertAction(selectedAlert._id, 'resolved'); setSelectedAlert(null); }}
                          className="flex-1 py-2.5 rounded-xl bg-success text-success-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Resolve</button>
                      </div>
                    )}
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 && <div className="text-center py-20 text-muted-foreground">No reports</div>}
            {reports.map((r, i) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedReport(r)}
                className="glass-card-hover rounded-xl p-4 flex items-center gap-4 cursor-pointer">
                <FileText className="w-6 h-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.userName} · {r.type} · {r.location.address}</p>
                </div>
                {typeof r.authenticityScore === 'number' ? (
                  <span
                    title={r.authenticityAnalysis?.reasons?.join(' · ') || ''}
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${
                      r.authenticityScore >= 70
                        ? 'bg-success/10 text-success border-success/30'
                        : r.authenticityScore >= 40
                        ? 'bg-warning/10 text-warning border-warning/30'
                        : 'bg-emergency/10 text-emergency border-emergency/30'
                    }`}
                  >
                    {r.authenticityScore >= 70 ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                    {r.authenticityScore}
                  </span>
                ) : <span className="text-xs text-muted-foreground">AI pending</span>}
                <span className="text-xs capitalize font-medium">{r.status}</span>
                {r.status === 'pending' && (
                  <div onClick={e => e.stopPropagation()} className="flex gap-1">
                    <button onClick={() => handleReportAction(r._id, 'approved')} className="p-2 rounded-lg bg-success/10 hover:bg-success/20 border border-success/20 transition-all active:scale-90"><CheckCircle className="w-4 h-4 text-success" /></button>
                    <button onClick={() => handleReportAction(r._id, 'rejected')} className="p-2 rounded-lg bg-emergency/10 hover:bg-emergency/20 border border-emergency/20 transition-all active:scale-90"><XCircle className="w-4 h-4 text-emergency" /></button>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Report Detail Dialog */}
            <Dialog open={!!selectedReport} onOpenChange={open => !open && setSelectedReport(null)}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                {selectedReport && (
                  <>
                    <DialogHeader>
                      <DialogTitle>{selectedReport.title}</DialogTitle>
                      <DialogDescription>Crime Report Details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{selectedReport.type}</p></div>
                        <div><span className="text-muted-foreground">Severity</span><p className="font-medium capitalize">{selectedReport.severity}</p></div>
                        <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{selectedReport.status}</p></div>
                        <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(selectedReport.createdAt).toLocaleDateString()}</p></div>
                        <div><span className="text-muted-foreground">Reported By</span><p className="font-medium">{selectedReport.userName}</p></div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted From</span>
                        <p className="font-medium">{selectedReport.location.address || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">Lat: {selectedReport.location.lat.toFixed(4)}, Lng: {selectedReport.location.lng.toFixed(4)}</p>
                      </div>
                      {selectedReport.crimeLocation && (
                        <div>
                          <span className="text-muted-foreground">Crime Location</span>
                          <p className="font-medium">{selectedReport.crimeLocation.address || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">Lat: {selectedReport.crimeLocation.lat.toFixed(4)}, Lng: {selectedReport.crimeLocation.lng.toFixed(4)}</p>
                        </div>
                      )}
                      <div><span className="text-muted-foreground">Description</span><p className="mt-1">{selectedReport.description}</p></div>
                      <div className={`rounded-lg p-3 border ${
                        typeof selectedReport.authenticityScore !== 'number'
                          ? 'bg-secondary/30 border-border'
                          : selectedReport.authenticityScore >= 70
                          ? 'bg-success/5 border-success/30'
                          : selectedReport.authenticityScore >= 40
                          ? 'bg-warning/5 border-warning/30'
                          : 'bg-emergency/5 border-emergency/30'
                      }`}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-semibold flex items-center gap-2">
                            {typeof selectedReport.authenticityScore !== 'number'
                              ? <Shield className="w-4 h-4 text-muted-foreground" />
                              : selectedReport.authenticityScore >= 70
                              ? <ShieldCheck className="w-4 h-4 text-success" />
                              : <ShieldAlert className="w-4 h-4 text-warning" />}
                            AI Authenticity
                          </span>
                          {typeof selectedReport.authenticityScore === 'number' && (
                            <span className="text-sm font-bold">
                              {selectedReport.authenticityScore}/100 · {selectedReport.authenticityAnalysis?.verdict?.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {typeof selectedReport.authenticityScore === 'number' ? (
                          <>
                            {selectedReport.authenticityAnalysis?.flags && selectedReport.authenticityAnalysis.flags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {selectedReport.authenticityAnalysis.flags.map((flag, index) => (
                                  <span key={index} className="text-[10px] uppercase tracking-wide bg-background/60 border border-border px-1.5 py-0.5 rounded">{flag}</span>
                                ))}
                              </div>
                            )}
                            {selectedReport.authenticityAnalysis?.reasons && (
                              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                {selectedReport.authenticityAnalysis.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                              </ul>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">No analysis is stored yet. Run it after confirming the Gemini function is configured.</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Automated triage only; an administrator makes the final decision.</p>
                        {typeof selectedReport.authenticityScore !== 'number' && (
                          <button onClick={() => void analyzeSelectedReport()} disabled={analyzingReport}
                            className="mt-3 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                            {analyzingReport ? 'Analyzing…' : 'Run AI analysis'}
                          </button>
                        )}
                      </div>
                      {selectedReport.mediaNames && selectedReport.mediaNames.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Evidence</span>
                          <EvidenceFiles names={selectedReport.mediaNames} paths={selectedReport.mediaPaths} />
                        </div>
                      )}
                      {selectedReport.statusUpdates && selectedReport.statusUpdates.length > 0 && (
                        <div>
                          <span className="text-muted-foreground font-semibold">Status Timeline</span>
                          <div className="mt-2 space-y-3">
                            {selectedReport.statusUpdates.map((u, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className="w-3 h-3 rounded-full bg-primary" />
                                  {i < selectedReport.statusUpdates!.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                                </div>
                                <div>
                                  <p className="font-medium capitalize text-sm">{u.status}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(u.timestamp).toLocaleString()}</p>
                                  {u.note && <p className="text-xs mt-0.5 text-muted-foreground italic">{u.note}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedReport.status === 'pending' && (
                        <div className="flex gap-3 mt-4">
                          <button onClick={() => { handleReportAction(selectedReport._id, 'approved', 'Report approved by admin'); setSelectedReport(null); }}
                            className="flex-1 py-2.5 rounded-xl bg-success text-success-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Approve</button>
                          <button onClick={() => { handleReportAction(selectedReport._id, 'investigating', 'Investigation initiated'); setSelectedReport(null); }}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Investigate</button>
                          <button onClick={() => { handleReportAction(selectedReport._id, 'rejected', 'Report rejected by admin'); setSelectedReport(null); }}
                            className="flex-1 py-2.5 rounded-xl bg-emergency text-emergency-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Reject</button>
                        </div>
                      )}
                      {/* Admin transparency editor */}
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <div className="text-xs font-semibold text-muted-foreground">ADMIN ACTION & TRANSPARENCY</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Assigned Station</label>
                            <input value={adminEdit.assignedStation} onChange={e => setAdminEdit(p => ({ ...p, assignedStation: e.target.value }))}
                              placeholder="e.g. Dehradun Central PS"
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Estimated Resolution</label>
                            <input value={adminEdit.estimatedResolutionTime} onChange={e => setAdminEdit(p => ({ ...p, estimatedResolutionTime: e.target.value }))}
                              placeholder="e.g. 3 days"
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Action Taken</label>
                          <input value={adminEdit.action} onChange={e => setAdminEdit(p => ({ ...p, action: e.target.value }))}
                            placeholder="e.g. FIR registered, patrol dispatched"
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Internal Note</label>
                          <textarea value={adminEdit.note} onChange={e => setAdminEdit(p => ({ ...p, note: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveAdminAction}
                            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Save Admin Action</button>
                          {selectedReport.status !== 'resolved' && (
                            <button onClick={() => { handleReportAction(selectedReport._id, 'resolved', 'Case resolved by admin'); setSelectedReport(null); }}
                              className="flex-1 py-2 rounded-lg bg-success text-success-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95">Mark Resolved</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* SERVICES TAB */}
        {tab === 'services' && (
          <div className="space-y-6">
            <form onSubmit={handleAddService} className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Add Emergency Service</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name *</label>
                  <input value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Central Police Station" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type *</label>
                  <select value={newService.type} onChange={e => setNewService(p => ({ ...p, type: e.target.value as EmergencyService['type'] }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Address *</label>
                  <input value={newService.address} onChange={e => setNewService(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Full address" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone *</label>
                  <input value={newService.phone} onChange={e => setNewService(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0135-XXXXXXX" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Latitude</label>
                  <input type="number" step="any" required value={newService.lat} onChange={e => setNewService(p => ({ ...p, lat: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="30.3165" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Longitude</label>
                  <input type="number" step="any" required value={newService.lng} onChange={e => setNewService(p => ({ ...p, lng: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="78.0322" />
                </div>
              </div>
              <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </form>

            <div className="space-y-3">
              {services.map((s, i) => (
                <motion.div key={s._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-xl p-4 flex items-center gap-4">
                  <span className="text-2xl">{SERVICE_ICONS[s.type] || '📍'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.address}</p>
                    <p className="text-sm text-muted-foreground">{s.phone}</p>
                  </div>
                  <span className="text-xs capitalize bg-accent px-2 py-1 rounded">{s.type}</span>
                  <button onClick={() => handleDeleteService(s._id)} className="p-2 rounded-lg hover:bg-emergency/10 transition-all text-muted-foreground hover:text-emergency active:scale-90">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* USERS / CITIZENS TAB */}
        {tab === 'users' && (() => {
          const citizensCount = allUsers.filter(u => u.role === 'citizen').length;
          const adminsCount = allUsers.filter(u => u.role === 'admin').length;
          const blockedCount = allUsers.filter(u => u.accessStatus === 'temporarily_blocked').length;
          const blacklistedCount = allUsers.filter(u => u.accessStatus === 'blacklisted').length;
          const activeCount = allUsers.filter(u => !u.accessStatus || u.accessStatus === 'active').length;

          const filteredUsers = allUsers.filter(u => {
            if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
            const status = u.accessStatus || 'active';
            if (userAccessFilter !== 'all' && status !== userAccessFilter) return false;
            if (userSearchQuery.trim()) {
              const q = userSearchQuery.trim().toLowerCase();
              return (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.phone && u.phone.toLowerCase().includes(q))
              );
            }
            return true;
          });

          const citizenReports = editingCitizen ? reports.filter(r => r.userId === editingCitizen._id) : [];

          return (
            <div className="space-y-4">
              {/* Header summary & stats */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" /> Citizen & User Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Review registered citizens, manage access permissions, verify reports, and update contact profiles.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">
                      {citizensCount} Citizens
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-accent text-muted-foreground font-medium">
                      {adminsCount} Admins
                    </span>
                    {(blockedCount > 0 || blacklistedCount > 0) && (
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-emergency/15 text-emergency font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {blockedCount + blacklistedCount} Restricted
                      </span>
                    )}
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-border">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={e => setUserSearchQuery(e.target.value)}
                      placeholder="Search citizens by name, email, or phone number..."
                      className="w-full pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {userSearchQuery && (
                      <button
                        onClick={() => setUserSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-secondary/60 p-1 rounded-lg text-xs">
                      {(['all', 'citizen', 'admin'] as const).map(role => (
                        <button
                          key={role}
                          onClick={() => setUserRoleFilter(role)}
                          className={`px-2.5 py-1 rounded capitalize font-medium transition-all ${
                            userRoleFilter === role
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {role === 'all' ? 'All Roles' : role === 'citizen' ? `Citizens (${citizensCount})` : `Admins (${adminsCount})`}
                        </button>
                      ))}
                    </div>

                    <div className="flex bg-secondary/60 p-1 rounded-lg text-xs">
                      {(['all', 'active', 'temporarily_blocked', 'blacklisted'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setUserAccessFilter(status)}
                          className={`px-2.5 py-1 rounded capitalize font-medium transition-all ${
                            userAccessFilter === status
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {status === 'all'
                            ? 'All Access'
                            : status === 'active'
                            ? `Active (${activeCount})`
                            : status === 'temporarily_blocked'
                            ? `Blocked (${blockedCount})`
                            : `Blacklist (${blacklistedCount})`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Users List */}
              {filteredUsers.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-foreground">No matching users found</p>
                  <p className="text-sm mt-1">Try adjusting your search query or status filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u, i) => {
                    const userReports = reports.filter(r => r.userId === u._id);
                    const isRestricted = u.accessStatus === 'temporarily_blocked' || u.accessStatus === 'blacklisted';

                    return (
                      <motion.div
                        key={u._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`glass-card rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-all ${
                          u.accessStatus === 'blacklisted'
                            ? 'border-emergency/30 bg-emergency/5'
                            : u.accessStatus === 'temporarily_blocked'
                            ? 'border-warning/30 bg-warning/5'
                            : 'border-border/60 hover:border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                            u.role === 'admin'
                              ? 'bg-primary/15 text-primary border border-primary/20'
                              : isRestricted
                              ? 'bg-emergency/15 text-emergency border border-emergency/20'
                              : 'bg-accent text-accent-foreground border border-border'
                          }`}>
                            {u.name ? u.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground truncate">{u.name || 'Unnamed Citizen'}</p>
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                              }`}>
                                {u.role}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>
                              {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span>}
                              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badges & Action Buttons */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                          {/* Report count */}
                          <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-lg bg-secondary/50" title="Total reports submitted by this user">
                            {userReports.length} {userReports.length === 1 ? 'report' : 'reports'}
                          </span>

                          {/* Access Status Badge */}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                            u.accessStatus === 'blacklisted'
                              ? 'bg-emergency/15 text-emergency border border-emergency/30'
                              : u.accessStatus === 'temporarily_blocked'
                              ? 'bg-warning/15 text-warning border border-warning/30'
                              : 'bg-success/15 text-success border border-success/30'
                          }`}>
                            {u.accessStatus === 'blacklisted' ? (
                              <><ShieldBan className="w-3.5 h-3.5" /> Blacklisted</>
                            ) : u.accessStatus === 'temporarily_blocked' ? (
                              <><ShieldAlert className="w-3.5 h-3.5" /> Blocked</>
                            ) : (
                              <><ShieldCheck className="w-3.5 h-3.5" /> Allowed</>
                            )}
                          </span>

                          {/* Quick Unblock button if restricted */}
                          {isRestricted && (
                            <button
                              onClick={(e) => void handleQuickWhitelist(u, e)}
                              className="px-3 py-1.5 rounded-lg bg-success/15 text-success hover:bg-success/25 font-semibold text-xs flex items-center gap-1.5 transition-all"
                              title="Restore full account access"
                            >
                              <Unlock className="w-3.5 h-3.5" /> Unblock
                            </button>
                          )}

                          {/* Citizen Manage button */}
                          {u.role === 'citizen' && (
                            <button
                              onClick={() => openCitizenEditor(u)}
                              className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                              title="Manage citizen profile and permissions"
                            >
                              <Shield className="w-3.5 h-3.5" /> Manage Citizen
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Comprehensive Citizen Management Dialog */}
              <Dialog open={!!editingCitizen} onOpenChange={open => !open && !savingCitizen && !savingAccessAction && setEditingCitizen(null)}>
                <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Manage Citizen: {editingCitizen?.name}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCitizen?.email} · Account ID: <span className="font-mono text-xs">{editingCitizen?._id}</span>
                    </DialogDescription>
                  </DialogHeader>

                  {editingCitizen && (
                    <div className="space-y-5 pt-2">
                      {/* Status Summary Banner */}
                      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                        editingCitizen.accessStatus === 'blacklisted'
                          ? 'bg-emergency/10 border-emergency/30 text-emergency'
                          : editingCitizen.accessStatus === 'temporarily_blocked'
                          ? 'bg-warning/10 border-warning/30 text-warning'
                          : 'bg-success/10 border-success/30 text-success'
                      }`}>
                        {editingCitizen.accessStatus === 'blacklisted' ? (
                          <ShieldBan className="w-5 h-5 mt-0.5 shrink-0" />
                        ) : editingCitizen.accessStatus === 'temporarily_blocked' ? (
                          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 text-xs">
                          <p className="font-bold text-sm">
                            {editingCitizen.accessStatus === 'blacklisted'
                              ? 'Account Blacklisted'
                              : editingCitizen.accessStatus === 'temporarily_blocked'
                              ? 'Account Temporarily Blocked'
                              : 'Account Active & Permitted'}
                          </p>
                          <p className="mt-0.5 text-foreground/80">
                            {editingCitizen.accessStatus === 'blacklisted'
                              ? 'This citizen is indefinitely barred from submitting crime reports and triggering SOS alerts.'
                              : editingCitizen.accessStatus === 'temporarily_blocked'
                              ? `Restricted until ${editingCitizen.blockedUntil ? new Date(editingCitizen.blockedUntil).toLocaleString() : 'expiration'}. They cannot submit new reports during this time.`
                              : 'This citizen can submit crime reports, trigger emergency SOS alerts, and interact with the AI assistant.'}
                          </p>
                        </div>
                      </div>

                      {/* Section 1: Contact Profile */}
                      <div className="glass-card rounded-xl p-4 border border-border space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <User className="w-4 h-4 text-primary" /> Contact Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="citizen-name" className="text-xs text-muted-foreground font-medium mb-1 block">Full Name</label>
                            <input
                              id="citizen-name"
                              value={citizenForm.name}
                              onChange={event => setCitizenForm(form => ({ ...form, name: event.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label htmlFor="citizen-phone" className="text-xs text-muted-foreground font-medium mb-1 block">Phone Number</label>
                            <input
                              id="citizen-phone"
                              type="tel"
                              value={citizenForm.phone}
                              onChange={event => setCitizenForm(form => ({ ...form, phone: event.target.value }))}
                              placeholder="+91 XXXXXXXXXX"
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => void saveCitizenProfile()}
                            disabled={savingCitizen || !citizenForm.name.trim()}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {savingCitizen ? 'Saving...' : 'Save Contact Details'}
                          </button>
                        </div>
                      </div>

                      {/* Section 2: Account Access Permissions */}
                      <div className="glass-card rounded-xl p-4 border border-border space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-primary" /> Access Control & Restrictions
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Manage citizen permissions to submit reports, invoke emergency SOS, and access platform services.
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Temporary Block selector & button */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              aria-label="Temporary block duration"
                              value={blockDurationHours}
                              onChange={event => setBlockDurationHours(Number(event.target.value))}
                              className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                            >
                              <option value={1}>1 hour</option>
                              <option value={6}>6 hours</option>
                              <option value={12}>12 hours</option>
                              <option value={24}>24 hours (1 day)</option>
                              <option value={72}>72 hours (3 days)</option>
                              <option value={168}>7 days (1 week)</option>
                              <option value={720}>30 days (1 month)</option>
                            </select>
                            <button
                              onClick={() => void performCitizenAccessAction('temporary_block')}
                              disabled={savingAccessAction}
                              className="px-3.5 py-2 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 text-xs font-semibold disabled:opacity-50 transition-all"
                            >
                              Apply Temporary Block
                            </button>
                          </div>

                          {/* Blacklist button */}
                          {editingCitizen.accessStatus !== 'blacklisted' && (
                            <button
                              onClick={() => void performCitizenAccessAction('blacklist')}
                              disabled={savingAccessAction}
                              className="px-3.5 py-2 rounded-lg bg-emergency/15 text-emergency hover:bg-emergency/25 text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5"
                            >
                              <ShieldBan className="w-3.5 h-3.5" /> Blacklist Citizen
                            </button>
                          )}

                          {/* Whitelist / Restore button */}
                          {editingCitizen.accessStatus !== 'active' && (
                            <button
                              onClick={() => void performCitizenAccessAction('whitelist')}
                              disabled={savingAccessAction}
                              className="px-3.5 py-2 rounded-lg bg-success text-success-foreground hover:opacity-90 text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" /> Restore Full Access
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Reports Submitted By This Citizen */}
                      <div className="glass-card rounded-xl p-4 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-primary" /> Reports by Citizen ({citizenReports.length})
                          </h4>
                          <span className="text-xs text-muted-foreground">Activity History</span>
                        </div>

                        {citizenReports.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            No crime reports submitted yet by this citizen.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {citizenReports.map(report => (
                              <div
                                key={report._id}
                                className="p-2.5 rounded-lg border border-border/60 bg-card/60 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{report.title}</p>
                                  <p className="text-muted-foreground text-[11px] truncate">
                                    {report.type} · {new Date(report.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {report.authenticityScore != null && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      report.authenticityScore >= 70 ? 'bg-success/15 text-success' : report.authenticityScore >= 40 ? 'bg-warning/15 text-warning' : 'bg-emergency/15 text-emergency'
                                    }`}>
                                      AI Score: {report.authenticityScore}%
                                    </span>
                                  )}
                                  <span className="capitalize px-2 py-0.5 rounded bg-accent font-medium text-[11px]">
                                    {report.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section 4: Danger Zone (Permanent Deletion) */}
                      <div className="rounded-xl border border-emergency/30 bg-emergency/5 p-4 space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-emergency flex items-center gap-1.5">
                            <Trash2 className="w-4 h-4" /> Danger Zone: Permanent Deletion
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Permanently removes the citizen authentication account, profile, and cascades cleanup across reports. This action cannot be reversed.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <input
                            aria-label="Type DELETE to confirm"
                            value={deleteConfirmation}
                            onChange={event => setDeleteConfirmation(event.target.value)}
                            placeholder="Type DELETE to confirm account deletion"
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emergency"
                          />
                          <button
                            onClick={() => void performCitizenAccessAction('delete')}
                            disabled={savingAccessAction || deleteConfirmation !== 'DELETE'}
                            className="w-full py-2.5 rounded-lg bg-emergency text-emergency-foreground font-semibold text-xs hover:opacity-90 transition-all disabled:opacity-40"
                          >
                            {savingAccessAction ? 'Deleting...' : 'Permanently Delete Citizen Account'}
                          </button>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="flex justify-end pt-2 border-t border-border">
                        <button
                          onClick={() => setEditingCitizen(null)}
                          disabled={savingCitizen || savingAccessAction}
                          className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
