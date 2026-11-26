import React from 'react';
import { Clock, Info } from 'lucide-react';

export type PublicBackendStatus = 'idle' | 'slow' | 'unreachable' | 'demo';

interface PublicConnectionNoticeProps {
  status: PublicBackendStatus;
  className?: string;
}

export const PublicConnectionNotice: React.FC<PublicConnectionNoticeProps> = ({
  status,
  className = '',
}) => {
  if (status === 'idle') {
    return null;
  }

  const isSlow = status === 'slow';
  const message =
    status === 'slow'
      ? 'Live listings are taking a little longer than usual — you can keep browsing while they load.'
      : status === 'demo'
      ? 'Showing sample Siliguri listings while live updates are offline.'
      : 'Live updates are temporarily unreachable — showing saved Siliguri listings so you can continue browsing.';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-2.5 shadow-[var(--shadow-subtle)] flex items-center gap-2.5 text-[13px] font-medium text-[var(--text-secondary)] ${className}`}
    >
      {isSlow ? (
        <Clock className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
      ) : (
        <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
};
