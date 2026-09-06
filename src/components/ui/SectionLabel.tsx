import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function SectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-[11px] font-medium tracking-[0.01em] text-text-secondary',
        className,
      )}
      {...props}
    />
  );
}
