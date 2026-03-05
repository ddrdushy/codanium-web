import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-foreground/[0.06]',
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export function ColumnSkeleton() {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-full rounded-xl border border-border bg-[var(--surface)]/50">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </div>
      <div className="p-2 space-y-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function ProjectSelectorSkeleton() {
  return (
    <div className="py-1 px-3 space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2.5 py-1.5">
          <Skeleton className="w-7 h-7 rounded-lg" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  );
}
