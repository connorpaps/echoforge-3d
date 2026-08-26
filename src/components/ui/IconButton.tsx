import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-sm border border-transparent text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98]',
        className,
      )}
      {...props}
    />
  );
}
