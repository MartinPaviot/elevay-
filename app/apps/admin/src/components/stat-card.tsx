interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  status?: "healthy" | "warning" | "critical";
}

export function StatCard({ label, value, subtitle, status }: StatCardProps) {
  const statusColors = {
    healthy: "var(--color-success)",
    warning: "var(--color-warning)",
    critical: "var(--color-danger)",
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border-default)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
          {label}
        </span>
        {status && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: statusColors[status] }}
          />
        )}
      </div>
      <div className="mt-1.5 text-[24px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function StatusDot({ status }: { status: "healthy" | "warning" | "critical" }) {
  const colors = {
    healthy: "var(--color-success)",
    warning: "var(--color-warning)",
    critical: "var(--color-danger)",
  };
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: colors[status] }}
    />
  );
}
