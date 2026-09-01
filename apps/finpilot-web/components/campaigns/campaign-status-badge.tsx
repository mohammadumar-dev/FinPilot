import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/lib/types";

const STATUS_STYLES: Record<CampaignStatus, string> = {
  proposed: "bg-muted text-muted-foreground",
  approved: "bg-warning/15 text-warning-foreground dark:text-warning",
  applied: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  ended: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  applied: "Live",
  rejected: "Rejected",
  ended: "Ended",
};

/** `expired` overrides an "applied" status to a distinct look — status
 * itself stays 'applied' in the DB (no background job flips it, see
 * campaign_service), so the UI is what actually tells the merchant a
 * scheduled campaign's end_date has passed even though nobody clicked
 * "End" yet. */
export function CampaignStatusBadge({ status, expired = false }: { status: CampaignStatus; expired?: boolean }) {
  if (status === "applied" && expired) {
    return (
      <Badge variant="outline" className="border-transparent bg-warning/15 text-warning-foreground dark:text-warning">
        Expired
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", STATUS_STYLES[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
