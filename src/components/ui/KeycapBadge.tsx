import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function KeycapBadge({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('keycap', className)} {...props} />;
}
