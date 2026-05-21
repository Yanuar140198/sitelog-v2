import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'secondary', size = 'md', ...rest }, ref,
) {
  const base = 'inline-flex items-center justify-center font-mono tracking-wider transition-all border-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] hover:bg-[var(--color-ink)] hover:border-[var(--color-ink)]',
    secondary: 'bg-white text-[var(--color-ink)] border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white',
    ghost: 'border-transparent hover:bg-neutral-100',
    danger: 'bg-white text-red-600 border-red-600 hover:bg-red-600 hover:text-white',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-sm',
  };
  return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...rest} />;
});
