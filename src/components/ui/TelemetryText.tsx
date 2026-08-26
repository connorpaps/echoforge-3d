import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TelemetryText({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'font-mono text-xs text-text-telemetry tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
