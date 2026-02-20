import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

const variants = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 focus:ring-slate-400',
  danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-base min-h-[48px]',
  lg: 'px-6 py-3 text-lg min-h-[56px]',
};

export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
