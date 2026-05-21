import { type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block font-mono text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5', className)}
      {...rest}
    />
  );
}
