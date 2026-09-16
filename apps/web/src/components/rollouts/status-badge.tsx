import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/rollout-options";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "outline",
  running: "secondary",
  complete: "default",
  failed: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
