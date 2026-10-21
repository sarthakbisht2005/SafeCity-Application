import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Bell, Menu, X, LogOut, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/report', label: 'Report Crime' },
    { path: '/heatmap', label: 'Crime Map' },
    { path: '/emergency-services', label: 'Emergency' },
  ];

  if (isAuthenticated && user?.role !== 'admin') {
    navItems.push({ path: '/my-reports', label: 'My Reports' });
  }

  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', label: 'Dashboard' });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 h-[var(--nav-height)] bg-card/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto h-full flex items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <Shield className="w-6 h-6 text-primary" />
          <span className="gradient-text">MySafeCity</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-accent transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {isAuthenticated && (
            <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-accent transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-emergency text-emergency-foreground rounded-full text-xs flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{user?.name}</span>
              </Link>
              <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground" aria-label="Sign out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2.5 rounded-lg hover:bg-accent text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card/95 backdrop-blur-xl border-b border-border shadow-xl overflow-hidden max-h-[calc(100vh-var(--nav-height))] overflow-y-auto"
          >
            <div className="p-4 flex flex-col gap-1.5">
              {isAuthenticated && (
                <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-accent/40 border border-border/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {user?.role}
                  </span>
                </div>
              )}

              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                    location.pathname === item.path
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              ))}

              {isAuthenticated ? (
                <>
                  <Link
                    to="/notifications"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      <Bell className="w-4 h-4" /> Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emergency text-emergency-foreground">
                        {unreadCount} new
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2.5"
                  >
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <div className="pt-2 border-t border-border/60 mt-1">
                    <button
                      onClick={() => { handleLogout(); setMobileOpen(false); }}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 text-left flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="pt-3 border-t border-border/60 mt-2 flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="w-full py-3 rounded-xl border border-input bg-card hover:bg-accent text-sm font-semibold text-center transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center hover:opacity-95 shadow-md shadow-primary/20 transition-all"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
