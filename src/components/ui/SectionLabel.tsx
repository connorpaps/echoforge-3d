import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function SectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-[11px] font-medium uppercase tracking-[0.05em] text-text-secondary',
        className,
      )}
      {...props}
    />
  );
}
