import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-muted-foreground)]">{label}</span>
        <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
      </div>
      <div className="font-display mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {trend && (
        <div
          className={cn(
            "mt-1 text-xs font-medium",
            trendUp ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
          )}
        >
          {trend}
        </div>
      )}
    </Card>
  );
}
