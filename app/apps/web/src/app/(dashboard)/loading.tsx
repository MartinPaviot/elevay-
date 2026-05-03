import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col">
      <HeaderSkeleton />
      <div className="flex-1 p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-row rounded-lg p-4"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <Skeleton className="h-4 rounded" style={{ width: `${50 + (i * 13) % 40}%` }} />
            <Skeleton className="mt-2 h-3 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
