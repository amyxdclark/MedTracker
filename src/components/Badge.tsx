import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'ok' | 'warning' | 'danger' | 'info' | 'neutral';
  children: ReactNode;
}

const badgeStyles = {
  ok: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
  neutral: 'bg-slate-600/30 text-slate-400',
};

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}
