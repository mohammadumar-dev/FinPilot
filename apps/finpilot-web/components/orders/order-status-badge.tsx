import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  created: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning-foreground dark:text-warning",
  paid: "bg-success/15 text-success",
  failed: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  created: "Created",
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", STATUS_STYLES[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
