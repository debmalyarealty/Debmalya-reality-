import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { goBackOrFallback } from '../lib/motion';

interface BackButtonProps {
  fallbackTo?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
  skipPathPrefixes?: string[];
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackTo = '/',
  label = 'Back',
  className = '',
  onClick,
  skipPathPrefixes,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    goBackOrFallback(navigate, fallbackTo, { skipPathPrefixes });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={`group relative z-10 min-h-[44px] px-4 py-2 rounded-full bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] border border-[var(--btn-secondary-border)] shadow-[var(--shadow-subtle)] text-sm font-medium text-[var(--btn-secondary-text)] inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${className}`}
    >
      <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)] shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  );
};
