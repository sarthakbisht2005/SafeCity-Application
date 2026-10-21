import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, MapPin, Clock, CheckCircle, XCircle, Search, Image, ArrowRight, Building2, Timer, Shield, ShieldCheck, ShieldAlert, type LucideIcon } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { CrimeReport } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import EvidenceFiles from '@/components/EvidenceFiles';

const statusConfig: Record<string, { color: string; icon: LucideIcon }> = {
  pending: { color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  approved: { color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  resolved: { color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  rejected: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  investigating: { color: 'bg-primary/10 text-primary border-primary/20', icon: Search },
};

function formatDuration(ms: number) {
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return '<1 hour';
  if (hours < 48) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function MyReportsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [selected, setSelected] = useState<CrimeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    let active = true;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const result = await api.getUserReports(user._id);
        if (!active) return;
        setReports(result);
        setSelected(current => current ? result.find(report => report._id === current._id) || current : null);
        setLoadError('');
      } catch {
        if (!active) return;
        setLoadError('Your reports could not be loaded. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(interval); };
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen py-8 pb-28 sm:pb-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Reports</h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8">Track status updates of your submitted reports</p>
        {loadError && <p role="alert" className="text-sm text-destructive mb-4">{loadError}</p>}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 sm:py-20 glass-card rounded-2xl p-6">
            <FileText className="w-14 h-14 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">No reports yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Submit a crime report to see it here</p>
            <button onClick={() => navigate('/report')} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm sm:text-base">
              Report a Crime
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r, i) => {
              const sc = statusConfig[r.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(r)}
                  className="glass-card-hover rounded-xl p-3.5 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer group">
                  <FileText className="w-10 h-10 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {r.type} · {new Date(r.createdAt).toLocaleDateString()}
                      {r.mediaNames && r.mediaNames.length > 0 && (
                        <> · <Image className="w-3 h-3 inline" /> {r.mediaNames.length} file(s)</>
                      )}
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {typeof r.authenticityScore === 'number'
                        ? `AI review: ${r.authenticityScore}/100 · ${r.authenticityAnalysis?.verdict?.replace('_', ' ') || 'assessed'}`
                        : 'AI authenticity review pending or unavailable'}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${sc.color} capitalize`}>
                    {r.status}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.title}</DialogTitle>
                  <DialogDescription>Report Details & Status Updates</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{selected.type}</p></div>
                    <div><span className="text-muted-foreground">Severity</span><p className="font-medium capitalize">{selected.severity}</p></div>
                    <div><span className="text-muted-foreground">Current Status</span><p className="font-medium capitalize">{selected.status}</p></div>
                    <div><span className="text-muted-foreground">Submitted</span><p className="font-medium">{new Date(selected.createdAt).toLocaleString()}</p></div>
                  </div>
                  {/* Resolution timing */}
                  <div className="rounded-lg border border-border p-3 bg-secondary/30">
                    {selected.status === 'resolved' && selected.resolvedAt ? (
                      <div className="flex items-center gap-2 text-success">
                        <Timer className="w-4 h-4" />
                        <span className="font-medium">Resolved in {formatDuration(new Date(selected.resolvedAt).getTime() - new Date(selected.createdAt).getTime())}</span>
                      </div>
                    ) : selected.status === 'investigating' ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Search className="w-4 h-4" />
                        <span className="font-medium">Under Investigation</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium capitalize">Status: {selected.status}</span>
                      </div>
                    )}
                  </div>
                  {/* Admin transparency */}
                  {(selected.assignedStation || selected.estimatedResolutionTime || selected.adminAction?.action) && (
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> ADMIN ACTION</div>
                      {selected.assignedStation && (
                        <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" /> {selected.assignedStation}</div>
                      )}
                      {selected.estimatedResolutionTime && (
                        <div className="flex items-center gap-2 text-sm"><Timer className="w-4 h-4 text-muted-foreground" /> Estimated: {selected.estimatedResolutionTime}</div>
                      )}
                      {selected.adminAction?.action && (
                        <div className="text-sm"><span className="text-muted-foreground">Action taken: </span>{selected.adminAction.action}</div>
                      )}
                      {selected.adminAction?.note && (
                        <div className="text-xs text-muted-foreground italic">{selected.adminAction.note}</div>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Submitted From</span>
                    <p className="font-medium">{selected.location.address || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Lat: {selected.location.lat.toFixed(4)}, Lng: {selected.location.lng.toFixed(4)}</p>
                  </div>
                  {selected.crimeLocation && (
                    <div>
                      <span className="text-muted-foreground">Crime Location</span>
                      <p className="font-medium">{selected.crimeLocation.address || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">Lat: {selected.crimeLocation.lat.toFixed(4)}, Lng: {selected.crimeLocation.lng.toFixed(4)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Description</span>
                    <p className="mt-1">{selected.description}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {typeof selected.authenticityScore === 'number'
                        ? selected.authenticityScore < 50
                          ? <ShieldAlert className="w-4 h-4 text-warning" />
                          : <ShieldCheck className="w-4 h-4 text-success" />
                        : <Shield className="w-4 h-4 text-muted-foreground" />}
                      AI authenticity review
                      {typeof selected.authenticityScore === 'number' && (
                        <span className="ml-auto">{selected.authenticityScore}/100</span>
                      )}
                    </div>
                    {typeof selected.authenticityScore === 'number' ? (
                      <>
                        <p className="text-sm capitalize">Assessment: {selected.authenticityAnalysis?.verdict?.replace('_', ' ') || 'available'}</p>
                        {selected.authenticityAnalysis?.reasons?.length ? (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {selected.authenticityAnalysis.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No AI assessment is available yet. It may still be processing or the analysis service may be unavailable.</p>
                    )}
                    <p className="text-xs text-muted-foreground">This automated score is only a review aid. It does not determine the report outcome; an administrator reviews reports.</p>
                  </div>
                  {selected.mediaNames && selected.mediaNames.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Evidence Files</span>
                      <EvidenceFiles names={selected.mediaNames} paths={selected.mediaPaths} />
                    </div>
                  )}
                  {selected.statusUpdates && selected.statusUpdates.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-semibold">Status Timeline</span>
                      <div className="mt-2 space-y-3">
                        {selected.statusUpdates.map((u, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-primary" />
                              {i < selected.statusUpdates!.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
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
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
