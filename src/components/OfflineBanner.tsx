import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/networkUtils';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2rem)] max-w-xl px-4 py-2.5 rounded-xl border shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-medium"
      style={{
        backgroundColor: 'var(--bg-surface, #1D2A23)',
        borderColor: 'var(--border-hairline, rgba(255,255,255,0.16))',
        color: 'var(--text-primary, #FAF6EE)',
      }}
    >
      <WifiOff size={16} className="shrink-0 text-amber-400" aria-hidden="true" />
      <span>No internet connection — some features may be unavailable until you reconnect.</span>
    </div>
  );
};
