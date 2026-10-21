import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  FileText,
  Info,
  Shield,
  CheckCheck,
  RotateCw,
  Inbox,
  AlertCircle,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface NotificationConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  badge: string;
  label: string;
}

const typeConfig: Record<string, NotificationConfig> = {
  sos: {
    icon: AlertTriangle,
    color: 'text-emergency',
    bg: 'bg-emergency/10 border-emergency/20',
    badge: 'bg-emergency/15 text-emergency border-emergency/30',
    label: 'SOS Alert',
  },
  crime: {
    icon: FileText,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    badge: 'bg-warning/15 text-warning border-warning/30',
    label: 'Crime Report',
  },
  alert: {
    icon: Shield,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/20',
    badge: 'bg-primary/15 text-primary border-primary/30',
    label: 'City Advisory',
  },
  system: {
    icon: Info,
    color: 'text-muted-foreground',
    bg: 'bg-muted border-border',
    badge: 'bg-muted text-muted-foreground border-border',
    label: 'System Notice',
  },
  info: {
    icon: Info,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 border-sky-500/20',
    badge: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
    label: 'Information',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    label: 'Safety Warning',
  },
};

const defaultConfig: NotificationConfig = {
  icon: Bell,
  color: 'text-primary',
  bg: 'bg-primary/10 border-primary/20',
  badge: 'bg-primary/15 text-primary border-primary/30',
  label: 'Notification',
};

function getTypeConfig(type: string | undefined | null): NotificationConfig {
  if (!type) return defaultConfig;
  const key = type.toLowerCase().trim();
  return typeConfig[key] || defaultConfig;
}

function formatNotificationTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

type FilterType = 'all' | 'unread' | 'alerts';

export default function NotificationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    refreshNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<FilterType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.type === 'sos' || n.type === 'alert' || n.type === 'warning';
    return true;
  });

  const alertsCount = notifications.filter(
    n => n.type === 'sos' || n.type === 'alert' || n.type === 'warning'
  ).length;

  return (
    <div className="min-h-screen py-8 pb-28 sm:pb-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emergency text-emergency-foreground">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {unreadCount === 0
                ? 'All caught up! No unread notifications'
                : `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} requiring your attention`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || notificationsLoading}
              title="Refresh notifications"
              className="p-2 rounded-lg border border-border bg-card/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 mb-6 border-b border-border/60 pb-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <span>All</span>
              <span className="text-xs opacity-75">({notifications.length})</span>
            </button>

            <button
              onClick={() => setFilter('unread')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'unread'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full ${
                  filter === 'unread' ? 'bg-white/20 text-white' : 'bg-emergency text-emergency-foreground'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilter('alerts')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'alerts'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <span>Urgent Alerts</span>
              {alertsCount > 0 && (
                <span className="text-xs opacity-75">({alertsCount})</span>
              )}
            </button>
          </div>
        )}

        {/* Error notification if any */}
        {notificationsError && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{notificationsError}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Notifications List / Skeleton / Empty States */}
        {notificationsLoading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="glass-card rounded-xl p-4 flex items-start gap-3 animate-pulse border border-border/40"
              >
                <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4 glass-card rounded-2xl border border-border/50"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Notifications Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              You are completely caught up! High-priority emergency dispatches, crime report updates, and city advisories will appear right here in real time.
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent text-sm font-medium transition-colors"
            >
              <RotateCw className="w-4 h-4" /> Check for updates
            </button>
          </motion.div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4 glass-card rounded-2xl border border-border/50"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {filter === 'unread' ? 'No unread notifications' : 'No matching notifications'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
              {filter === 'unread'
                ? "You've reviewed all incoming alerts and system messages."
                : 'There are no notifications matching the selected filter.'}
            </p>
            <button
              onClick={() => setFilter('all')}
              className="text-primary text-sm font-medium hover:underline"
            >
              View all notifications
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map(n => {
                const config = getTypeConfig(n.type);
                const Icon = config.icon;
                const relativeTime = formatNotificationTime(n.createdAt);

                return (
                  <motion.div
                    key={n._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => {
                      if (!n.read) markAsRead(n._id);
                    }}
                    className={`glass-card rounded-xl p-4 flex items-start gap-3.5 cursor-pointer transition-all border ${
                      !n.read
                        ? 'border-l-4 border-l-primary border-primary/20 shadow-sm bg-card'
                        : 'border-border/40 opacity-75 hover:opacity-100 hover:border-border'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 border`}
                    >
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded border ${config.badge}`}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime}
                        </span>
                      </div>

                      <h3
                        className={`text-sm ${
                          !n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                        }`}
                      >
                        {n.title}
                      </h3>

                      <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Unread indicator / status */}
                    <div className="shrink-0 flex items-center self-center pl-1">
                      {!n.read ? (
                        <div
                          className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"
                          title="Unread notification"
                        />
                      ) : (
                        <span title="Read">
                          <Check className="w-4 h-4 text-muted-foreground/40" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
