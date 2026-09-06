import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { FileText, CheckCircle2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function DoctorSummary() {
  const { user, role } = useAuth();
  const [pending, setPending] = useState<number | null>(null);
  const [completed, setCompleted] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState<number | null>(null);

  const isDoctor = role === "doctor" || role === "radiologist";

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { getCurrentUserOrganizationId } = await import("@/lib/org-scope");
    const organizationId = await getCurrentUserOrganizationId();
    if (!organizationId) {
      setPending(0);
      setCompleted(0);
      setScheduled(0);
      return;
    }

    const [p, c, s] = await Promise.all([
      isDoctor
        ? (() => {
            let q = (supabase as any)
              .from("studies")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", user.id)
              .eq("status", "review_pending");
            q = q.eq("organization_id", organizationId);
            return q;
          })()
        : (() => {
            let q = (supabase as any)
              .from("worksheets")
              .select("id", { count: "exact", head: true })
              .eq("sonographer_id", user.id)
              .eq("status", "draft");
            q = q.eq("organization_id", organizationId);
            return q;
          })(),
      isDoctor
        ? (() => {
            let q = (supabase as any)
              .from("worksheets")
              .select("id", { count: "exact", head: true })
              .eq("signed_by", user.id)
              .gte("updated_at", today.toISOString());
            q = q.eq("organization_id", organizationId);
            return q;
          })()
        : (() => {
            let q = (supabase as any)
              .from("worksheets")
              .select("id", { count: "exact", head: true })
              .eq("sonographer_id", user.id)
              .in("status", ["signed", "transmitted"])
              .gte("updated_at", today.toISOString());
            q = q.eq("organization_id", organizationId);
            return q;
          })(),
      (() => {
        let q = (supabase as any)
          .from("studies")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled");
        q = q.eq("organization_id", organizationId);
        return q;
      })(),
    ]);

    setPending(p.count ?? 0);
    setCompleted(c.count ?? 0);
    setScheduled(s.count ?? 0);
  }, [user, isDoctor]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="border-b bg-gradient-to-br from-primary/5 to-transparent p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        My Daily Summary
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-l-4 border-l-blue-500 p-2.5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-lg font-bold leading-none">{scheduled ?? "—"}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">Scheduled</div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-amber-500 p-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-lg font-bold leading-none">{pending ?? "—"}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {isDoctor ? "For Review" : "Drafts"}
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 p-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-lg font-bold leading-none">{completed ?? "—"}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">Done today</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
