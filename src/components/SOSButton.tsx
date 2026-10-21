import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function SOSButton() {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<'idle' | 'locating' | 'sending' | 'sent'>('idle');

  // Hide SOS for non-authenticated users and admin users
  if (!isAuthenticated || user?.role === 'admin') return null;

  const handleSOS = async () => {
    const isBlocked = user?.accessStatus === 'blacklisted'
      || (user?.accessStatus === 'temporarily_blocked' && (!user.blockedUntil || new Date(user.blockedUntil).getTime() > Date.now()));
    if (isBlocked) {
      toast.error('Your app account access is restricted. For emergencies, please call 100 directly.');
      return;
    }

    setState('locating');
    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
    } catch {
      setState('idle');
      toast.error('Location could not be confirmed. Enable location access and try again.');
      return;
    }

    setState('sending');
    try {
      await api.triggerSOS({ lat: position.coords.latitude, lng: position.coords.longitude });
      setState('sent');
      setTimeout(() => setState('idle'), 3000);
    } catch (error) {
      setState('idle');
      toast.error(error instanceof Error ? error.message : 'SOS could not be sent. Please try again.');
    }
  };

  if (state === 'sent') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-success text-success-foreground px-4 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-lg flex items-center gap-2 font-semibold text-sm sm:text-base"
      >
        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        Alert Sent!
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={handleSOS}
      disabled={state !== 'idle'}
      whileTap={{ scale: 0.95 }}
      aria-label="Send Emergency SOS Alert"
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-full font-bold shadow-2xl transition-all text-sm sm:text-base ${
        state === 'idle'
          ? 'bg-emergency text-emergency-foreground pulse-emergency hover:scale-105 active:scale-95'
          : 'bg-emergency/80 text-emergency-foreground cursor-wait'
      }`}
    >
      {state === 'idle' && (
        <>
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          SOS
        </>
      )}
      {state === 'locating' && (
        <>
          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          Locating...
        </>
      )}
      {state === 'sending' && (
        <>
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          Sending...
        </>
      )}
    </motion.button>
  );
}
