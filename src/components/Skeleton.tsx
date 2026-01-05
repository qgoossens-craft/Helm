interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-helm-surface-elevated rounded ${className}`}
    />
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className="p-6 rounded-xl bg-helm-surface border border-helm-border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="w-32 h-5" />
        </div>
        <Skeleton className="w-16 h-5 rounded" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="flex-1 h-2 rounded-full" />
        <Skeleton className="w-16 h-4" />
      </div>
    </div>
  )
}

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-helm-surface border border-helm-border rounded-lg">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="flex-1 h-4" />
    </div>
  )
}

export function InboxItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-helm-surface border border-helm-border rounded-lg">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1">
        <Skeleton className="w-3/4 h-4 mb-2" />
        <Skeleton className="w-16 h-3" />
      </div>
    </div>
  )
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-72 bg-helm-surface rounded-lg p-4">
      <Skeleton className="w-24 h-5 mb-4" />
      <div className="space-y-2">
        <KanbanCardSkeleton />
        <KanbanCardSkeleton />
      </div>
    </div>
  )
}

export function KanbanCardSkeleton() {
  return (
    <div className="p-3 bg-helm-bg border border-helm-border rounded-lg">
      <Skeleton className="w-full h-4 mb-2" />
      <Skeleton className="w-20 h-3" />
    </div>
  )
}
