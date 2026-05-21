import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm',
          'focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20',
          'disabled:bg-neutral-100 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
    );
  },
);
