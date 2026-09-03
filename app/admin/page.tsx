"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppNavbar } from "@/components/sonolynx/AppNavbar";
import { ReportTemplateManager } from "@/components/sonolynx/admin/ReportTemplateManager";
import { BrandingSettingsManager } from "@/components/sonolynx/admin/BrandingSettingsManager";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  Lock,
  Crown,
  Shield
} from "lucide-react";
import { Logo as SonolynxLogo } from "@/components/sonolynx/Logo";
import { toast } from "sonner";
import { 
  getCurrentUserOrganizationTier, 
  TIER_CONFIG, 
  type OrganizationTier, 
  type TierCapabilities 
} from "@/lib/org-scope";
import { Progress } from "@/components/ui/progress";
import { PricingModal } from "@/components/sonolynx/PricingModal";
import { PlatformControlPanel } from "@/components/sonolynx/admin/PlatformControlPanel";

type StaffRoleFilter = "all" | "admin" | "doctor" | "radiologist" | "sonographer";

interface HL7Row {
  id: string;
  created_at: string;
  sent_at?: string | null;
  status: string;
  message_type: string;
  worksheet_id: string | null;
  patient_mrn?: string;
  exam_type?: string;
  sonographer?: string;
  endpoint_url?: string | null;
  error_message?: string | null;
}

interface SignedReportRow {
  id: string;
  signed_at: string;
  report_text: string | null;
  status: string;
  patient_name: string;
  patient_mrn: string;
  doctor_name: string;
  exam_type: string;
}

interface StaffRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  organization_id: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string | null;
  account_status?: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
  code: string;
}

interface SystemHealth {
  supabaseConfigured: boolean;
  supabaseServiceRoleConfigured: boolean;
  dicomwebConfigured: boolean;
  hl7ExportConfigured: boolean;
  reportApiConfigured: boolean;
  gladiaApiConfigured: boolean;
}

const defaultSystemHealth: SystemHealth = {
  supabaseConfigured: false,
  supabaseServiceRoleConfigured: false,
  dicomwebConfigured: false,
  hl7ExportConfigured: false,
  reportApiConfigured: false,
  gladiaApiConfigured: false,
};

export default function AdminDashboard() {
  const { role, user, loading: authLoading, signOut } = useAuth();
  const untypedSupabase = supabase as any;
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "doctor" | "sonographer">("doctor");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [staffRoleFilter, setStaffRoleFilter] = useState<StaffRoleFilter>("all");

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [targetOrgId, setTargetOrgId] = useState<string>("");
  const [hl7Rows, setHl7Rows] = useState<HL7Row[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>(defaultSystemHealth);

  const [totalPatients, setTotalPatients] = useState<number | null>(null);
  const [totalStudies, setTotalStudies] = useState<number | null>(null);
  const [draftWorksheets, setDraftWorksheets] = useState<number | null>(null);
  const [signedReports, setSignedReports] = useState<number | null>(null);
  const [transmittedReports, setTransmittedReports] = useState<number | null>(null);
  const [failedHl7, setFailedHl7] = useState<number | null>(null);
  const [hl7SuccessRate, setHl7SuccessRate] = useState<number | null>(null);

  const [lastActivityByUser, setLastActivityByUser] = useState<Record<string, string>>({});
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [adminOrgName, setAdminOrgName] = useState<string>("");
  const [globalView, setGlobalView] = useState(false);
  const [orgTier, setOrgTier] = useState<OrganizationTier>("enterprise");
  const [tierLimits, setTierLimits] = useState<TierCapabilities>(TIER_CONFIG.enterprise);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const [signedReportsList, setSignedReportsList] = useState<SignedReportRow[]>([]);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [selectedReportText, setSelectedReportText] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const typedSupabase = supabase;
    const untypedSupabase = supabase as any;

    const {
      data: { session },
    } = await typedSupabase.auth.getSession();
    const currentUser = session?.user;
    const { data: adminProfile } = await untypedSupabase
      .from("profiles")
      .select("organization_id")
      .eq("id", currentUser?.id)
      .maybeSingle();
    const orgId = adminProfile?.organization_id ?? null;
    setOrganizationId(orgId);
    
    // Fetch Tier
    const tier = await getCurrentUserOrganizationTier();
    setOrgTier(tier);
    setTierLimits(TIER_CONFIG[tier]);

    const scopeByOrg = Boolean(orgId) && !globalView;

    const [
      patientsCount,
      studiesCount,
      draftsCount,
      signedCount,
      transmittedCount,
      failedHl7Count,
      allHl7Status,
      profilesRes,
      recentHl7Res,
      wsActivityRes,
      systemHealthRes,
      organizationsRes,
      signedReportsRes,
    ] = await Promise.all([
      (scopeByOrg
        ? untypedSupabase.from("patients").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`)
        : untypedSupabase.from("patients").select("id", { count: "exact", head: true })),
      (scopeByOrg
        ? untypedSupabase.from("studies").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`)
        : untypedSupabase.from("studies").select("id", { count: "exact", head: true })),
      (scopeByOrg
        ? untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`).eq("status", "draft")
        : untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).eq("status", "draft")),
      (scopeByOrg
        ? untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`).in("status", ["signed", "transmitted"])
        : untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).in("status", ["signed", "transmitted"])),
      (scopeByOrg
        ? untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`).eq("status", "transmitted")
        : untypedSupabase.from("worksheets").select("id", { count: "exact", head: true }).eq("status", "transmitted")),
      (scopeByOrg
        ? untypedSupabase.from("hl7_messages").select("id", { count: "exact", head: true }).or(`organization_id.eq.${orgId},organization_id.is.null`).eq("status", "failed")
        : untypedSupabase.from("hl7_messages").select("id", { count: "exact", head: true }).eq("status", "failed")),
      (scopeByOrg
        ? untypedSupabase.from("hl7_messages").select("status").or(`organization_id.eq.${orgId},organization_id.is.null`)
        : untypedSupabase.from("hl7_messages").select("status")),
      (scopeByOrg
        ? untypedSupabase.from("profiles").select("*").or(`organization_id.eq.${orgId},organization_id.is.null`).order("created_at", { ascending: false })
        : untypedSupabase.from("profiles").select("*").order("created_at", { ascending: false })),
      untypedSupabase
        .from("hl7_messages")
        .select(`
          id, created_at, sent_at, status, message_type, worksheet_id, endpoint_url, error_message,
          worksheets:worksheet_id (
            sonographer_id,
            studies:study_id (
              modality,
              patients:patient_id ( mrn )
            )
          )
        `)
        .match(scopeByOrg ? { organization_id: orgId } : {})
        .order("created_at", { ascending: false })
        .limit(20),
      untypedSupabase
        .from("worksheets")
        .select("sonographer_id, updated_at")
        .match(scopeByOrg ? { organization_id: orgId } : {})
        .order("updated_at", { ascending: false })
        .limit(500),
      fetch("/api/admin/system-health").then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as SystemHealth;
      }),
      untypedSupabase.from("organizations").select("id, name, code").order("name"),
      (() => {
        const q = untypedSupabase
          .from("worksheets")
          .select(`
            id, signed_at, report_text, status,
            signed_by,
            patients:patient_id ( first_name, last_name, mrn ),
            studies:study_id ( modality )
          `)
          .in("status", ["signed", "transmitted"])
          .order("signed_at", { ascending: false })
          .limit(50);
        if (scopeByOrg) q.or(`organization_id.eq.${orgId},organization_id.is.null`);
        return q;
      })(),
    ]);

    setTotalPatients(patientsCount.count ?? 0);
    setTotalStudies(studiesCount.count ?? 0);
    setDraftWorksheets(draftsCount.count ?? 0);
    setSignedReports(signedCount.count ?? 0);
    setTransmittedReports(transmittedCount.count ?? 0);
    setFailedHl7(failedHl7Count.count ?? 0);

    const allStatuses = (allHl7Status.data ?? []) as Array<{ status?: string }>;
    const success = allStatuses.filter((row: { status?: string }) => row.status === "transmitted" || row.status === "sent").length;
    setHl7SuccessRate(allStatuses.length > 0 ? Math.round((success / allStatuses.length) * 100) : 100);

    const loadedStaff = (profilesRes.data ?? []) as StaffRow[];
    const loadedOrgs = (organizationsRes.data ?? []) as OrganizationRow[];
    setOrganizations(loadedOrgs);

    // Merge authoritative role from user_roles table (profiles.role can be stale/null)
    const staffIds = loadedStaff.map((p) => p.id);
    let roleMap: Record<string, string> = {};
    if (staffIds.length > 0) {
      const { data: roleRows } = await untypedSupabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", staffIds);
      for (const row of (roleRows ?? []) as Array<{ user_id: string; role: string }>) {
        roleMap[row.user_id] = row.role;
      }
    }

    const mergedStaff = loadedStaff.map((person) => ({
      ...person,
      role: roleMap[person.id] ?? person.role ?? "unknown",
    }));
    setStaff(mergedStaff);

    // Background: backfill orphaned profiles (null org_id) to this admin's org
    if (orgId) {
      const orphans = loadedStaff.filter((p) => !(p as any).organization_id);
      if (orphans.length > 0) {
        untypedSupabase
          .from("profiles")
          .update({ organization_id: orgId })
          .in("id", orphans.map((p) => p.id))
          .then(({ error }: { error: any }) => {
            if (error) console.warn("[admin] backfill orphaned profiles failed:", error.message);
            else console.info("[admin] backfilled", orphans.length, "orphaned profile(s) to org", orgId);
          });
      }
    }

    const activityMap: Record<string, string> = {};
    for (const row of (wsActivityRes.data ?? []) as Array<{ sonographer_id?: string; updated_at?: string }>) {
      if (!row.sonographer_id || !row.updated_at) continue;
      if (!activityMap[row.sonographer_id]) {
        activityMap[row.sonographer_id] = row.updated_at;
      }
    }
    setLastActivityByUser(activityMap);

    const profileMap = new Map(loadedStaff.map((person) => [person.id, person]));

    const flatHl7: HL7Row[] = ((recentHl7Res.data ?? []) as any[]).map((row) => {
      const ws = row.worksheets;
      const study = ws?.studies;
      const patient = study?.patients;
      const sonographer = ws?.sonographer_id ? profileMap.get(ws.sonographer_id) : null;

      return {
        id: String(row.id),
        created_at: String(row.created_at),
        sent_at: row.sent_at ?? null,
        status: String(row.status ?? "unknown"),
        message_type: String(row.message_type ?? "ORU^R01"),
        worksheet_id: row.worksheet_id ?? null,
        patient_mrn: patient?.mrn,
        exam_type: study?.modality ?? "US",
        sonographer: sonographer
          ? ((sonographer.first_name || "") + " " + (sonographer.last_name || "")).trim() || sonographer.email
          : "Not available",
        endpoint_url: row.endpoint_url ?? null,
        error_message: row.error_message ?? null,
      };
    });
    setHl7Rows(flatHl7);

    if (systemHealthRes) {
      setSystemHealth(systemHealthRes);
    }

    const flatSigned = ((signedReportsRes.data ?? []) as any[]).map((row) => {
      const p = row.patients;
      const d = row.signed_by ? profileMap.get(row.signed_by) : null;
      return {
        id: row.id,
        signed_at: row.signed_at,
        report_text: row.report_text,
        status: row.status,
        patient_name: p ? ((p.first_name || "") + " " + (p.last_name || "")).trim() : "Unknown",
        patient_mrn: p?.mrn ?? "N/A",
        doctor_name: d ? ((d.first_name || "") + " " + (d.last_name || "")).trim() || d.email : "Unknown",
        exam_type: row.studies?.modality ?? "N/A",
      };
    });
    setSignedReportsList(flatSigned);

    setLoading(false);

    // Set defaults for creation
    if (orgId) {
      setTargetOrgId(orgId);
      const myOrg = loadedOrgs.find(o => o.id === orgId);
      if (myOrg) setAdminOrgName(myOrg.name);
    } else if (loadedOrgs.length > 0) {
      setTargetOrgId(loadedOrgs[0].id);
    }
  }, [globalView]);

  // Realtime subscription for global updates
  useEffect(() => {
    loadAll();
    // Check if super admin
    (async () => {
      const { data: { session } } = await (supabase as any).auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch("/api/admin/check-super-admin", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        setIsSuperAdmin(json.isSuperAdmin === true);
      } catch {
        setIsSuperAdmin(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalView]);

  useEffect(() => {
    const channel = supabase
      .channel("admin_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => {
          loadAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin") return;

    loadAll().catch((error) => {
      setLoading(false);
      toast.error("Admin dashboard load failed", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    });
  }, [authLoading, loadAll, role]);

  const filteredStaff = useMemo(() => {
    if (staffRoleFilter === "all") return staff;
    return staff.filter((person) => person.role === staffRoleFilter);
  }, [staff, staffRoleFilter]);

  const handleAccessDeniedLogout = async () => {
    try {
      await signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppNavbar />
        <div className="flex flex-1 items-center justify-center">
          <Card className="max-w-md p-8 text-center">
            <h1 className="text-xl font-bold">Access denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">This area is restricted to administrators.</p>
            <Button asChild className="mt-4">
              <Link href="/">Return to workspace</Link>
            </Button>
            <Button variant="outline" className="mt-2" onClick={handleAccessDeniedLogout}>
              Log out
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const handleCreateAccount = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newFirstName.trim() || !newLastName.trim()) {
      toast.error("Missing required fields", {
        description: "Email, password, first name, and last name are required.",
      });
      return;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await (supabase as any).auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          firstName: newFirstName,
          lastName: newLastName,
          role: newRole,
          organizationId: targetOrgId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to create account");
      }

      toast.success("Account created", {
        description: `${newRole} account created for ${newEmail}.`,
      });

      if (result?.roleWarning) {
        toast.warning("Role fallback applied", { description: result.roleWarning });
      }

      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewFirstName("");
      setNewLastName("");
      setNewRole("doctor");
      
      // Re-fetch only staff to keep it light
      const { data: newStaff } = await untypedSupabase.from("profiles").select("*").order("email");
      if (newStaff) setStaff(newStaff);
    } catch (error) {
      toast.error("Account creation failed", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteAccount = async (targetUserId: string, email: string) => {
    if (!confirm(`Delete account ${email}? This removes auth login and profile.`)) return;

    setDeletingUserId(targetUserId);
    try {
      const { data: { session } } = await (supabase as any).auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId: targetUserId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete account");
      }

      setStaff((prev) => prev.filter((u) => u.id !== targetUserId));
      toast.success("Account deleted", { description: email });
    } catch (error) {
      toast.error("Delete failed", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNavbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <SonolynxLogo size="md" className="hidden sm:flex" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Operational controls, system health, and workflow monitoring.</p>
            </div>
          </div>
            {organizationId && isSuperAdmin && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Boundary: {organizationId}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-view"
                    checked={globalView}
                    onChange={(e) => {
                      setGlobalView(e.target.checked);
                      // Trigger immediate reload
                      setTimeout(() => loadAll(), 0);
                    }}
                    className="h-3 w-3"
                  />
                  <label htmlFor="global-view" className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                    Enable Global View (Show all organizations)
                  </label>
                </div>
              </div>
            )}
          <Button 
            size="sm" 
            disabled={staff.length >= tierLimits.maxStaff}
            onClick={() => setCreateOpen(true)}
            title={staff.length >= tierLimits.maxStaff ? "Staff limit reached for your current plan." : ""}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> 
            {staff.length >= tierLimits.maxStaff ? "Limit Reached" : "Invite User"}
          </Button>
        </div>

        {/* ── Plan & Usage Section ── */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4 border-primary/20 bg-primary/5 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {orgTier === "individual" && <div className="p-2 rounded-full bg-muted text-muted-foreground"><Users className="h-4 w-4" /></div>}
                {orgTier === "professional" && <div className="p-2 rounded-full bg-blue-100 text-blue-600"><Shield className="h-4 w-4" /></div>}
                {orgTier === "enterprise" && <div className="p-2 rounded-full bg-amber-100 text-amber-600"><Crown className="h-4 w-4" /></div>}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Plan</div>
                  <div className="text-lg font-bold capitalize">
                    {orgTier === "professional" ? "Clinic" : orgTier} Tier
                  </div>
                </div>
              </div>
              {orgTier !== "enterprise" && (
                <Button variant="outline" size="sm" className="bg-background" onClick={() => setPricingOpen(true)}>
                  Upgrade Plan
                </Button>
              )}
              {orgTier === "enterprise" && (
                <Button variant="outline" size="sm" className="bg-background" onClick={() => setPricingOpen(true)}>
                  View Plans
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Staff Usage ({staff.length} / {tierLimits.maxStaff === Infinity ? "∞" : tierLimits.maxStaff})</span>
                <span className="font-medium">{Math.round((staff.length / (tierLimits.maxStaff === Infinity ? 100 : tierLimits.maxStaff)) * 100)}%</span>
              </div>
              <Progress value={(staff.length / (tierLimits.maxStaff === Infinity ? 100 : tierLimits.maxStaff)) * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground italic">
                {orgTier === "individual" && "Upgrade to Clinic to add up to 15 staff members and unlock the Custom Template Architect."}
                {orgTier === "professional" && "Upgrade to Enterprise for unlimited staff and hospital-wide deployment features."}
                {orgTier === "enterprise" && "You have full access to all enterprise capabilities."}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Feature Checklist</div>
            <div className="space-y-2">
              <FeatureCheck label="Staff Management" ok={true} />
              <FeatureCheck label="Standard Templates" ok={true} />
              <FeatureCheck label="Custom Architect" ok={tierLimits.canCreateCustomTemplates} />
              <FeatureCheck label="Conditional Logic" ok={tierLimits.canUseConditionalLogic} />
            </div>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Total Patients" value={loading ? "..." : String(totalPatients ?? 0)} icon={<Users className="h-5 w-5" />} accent="primary" />
          <MetricCard label="Total Studies" value={loading ? "..." : String(totalStudies ?? 0)} icon={<Activity className="h-5 w-5" />} accent="amber" />
          <MetricCard label="Draft Worksheets" value={loading ? "..." : String(draftWorksheets ?? 0)} icon={<Activity className="h-5 w-5" />} accent="amber" />
          <MetricCard label="Signed Reports" value={loading ? "..." : String(signedReports ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
          <MetricCard label="Transmitted Reports" value={loading ? "..." : String(transmittedReports ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
          <MetricCard label="Failed HL7 Messages" value={loading ? "..." : String(failedHl7 ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} accent="rose" />
        </div>

        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="reports">Signed Reports</TabsTrigger>
            <TabsTrigger value="system">System Configuration</TabsTrigger>
            <TabsTrigger value="hl7">HL7 Operations</TabsTrigger>
            <TabsTrigger value="templates">Report Templates</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="overview">Workflow Overview</TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="platform" className="gap-1.5 text-amber-600 data-[state=active]:text-amber-700">
                <Crown className="h-3.5 w-3.5" /> Platform Control
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Staff Directory</h2>
                  <p className="text-xs text-muted-foreground">Filter by role and monitor staff account metadata.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="roleFilter" className="text-xs text-muted-foreground">Role Filter</Label>
                  <select
                    id="roleFilter"
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={staffRoleFilter}
                    onChange={(event) => setStaffRoleFilter(event.target.value as StaffRoleFilter)}
                  >
                    <option value="all">All</option>
                    <option value="admin">Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="radiologist">Radiologist</option>
                    <option value="sonographer">Sonographer</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          {loading ? "Loading..." : "No staff records for selected role."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((person) => {
                        const displayName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Not available";
                        const accountStatus = person.account_status ?? person.status ?? "Not available";
                        const createdDate = person.created_at ? new Date(person.created_at).toLocaleString() : "Not available";
                        const lastActivity = lastActivityByUser[person.id]
                          ? new Date(lastActivityByUser[person.id]).toLocaleString()
                          : "Not available";

                        return (
                          <TableRow key={person.id}>
                            <TableCell className="font-medium">{displayName}</TableCell>
                            <TableCell className="text-muted-foreground">{person.email || "Not available"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {organizations.find(o => o.id === person.organization_id)?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={person.role} />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{accountStatus}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{createdDate}</TableCell>
                            <TableCell className="text-xs">{lastActivity}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={person.id === user?.id || deletingUserId === person.id}
                                onClick={() => handleDeleteAccount(person.id, person.email)}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                {deletingUserId === person.id ? "Deleting..." : "Remove"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card className="overflow-hidden">
              <div className="border-b p-4">
                <h2 className="text-sm font-semibold">Signed Clinical Reports</h2>
                <p className="text-xs text-muted-foreground">Review finalized reports authored and signed by medical staff.</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Signed</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Exam Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signedReportsList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          {loading ? "Loading..." : "No signed reports found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      signedReportsList.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="text-xs">
                            {new Date(report.signed_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{report.patient_name}</div>
                            <div className="text-[10px] text-muted-foreground">MRN: {report.patient_mrn}</div>
                          </TableCell>
                          <TableCell className="text-sm">{report.doctor_name}</TableCell>
                          <TableCell className="text-xs">{report.exam_type}</TableCell>
                          <TableCell>
                            <Badge className={report.status === "transmitted" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"}>
                              {report.status === "transmitted" ? "Transmitted" : "Signed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedReportText(report.report_text || "");
                                setViewReportOpen(true);
                              }}
                            >
                              View Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">System Configuration Health</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <HealthCard label="Supabase Configured" ok={systemHealth.supabaseConfigured} />
                <HealthCard label="Supabase Service Role Configured" ok={systemHealth.supabaseServiceRoleConfigured} />
                <HealthCard label="DICOMweb Endpoint Configured" ok={systemHealth.dicomwebConfigured} />
                <HealthCard label="HL7 Export Endpoint Configured" ok={systemHealth.hl7ExportConfigured} />
                <HealthCard label="Report API Configured" ok={systemHealth.reportApiConfigured} />
                <HealthCard label="Gladia API Configured" ok={systemHealth.gladiaApiConfigured} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Only configured/missing status is shown. No secret values are exposed.</p>
            </Card>
          </TabsContent>

          <TabsContent value="hl7" className="space-y-4">
            <Card className="overflow-hidden">
              <div className="border-b p-4">
                <h2 className="text-sm font-semibold">HL7 Operations Monitor</h2>
                <p className="text-xs text-muted-foreground">Recent messages with delivery status and error visibility.</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Message Type</TableHead>
                      <TableHead>Patient MRN</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hl7Rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          {loading ? "Loading..." : "No HL7 records available yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      hl7Rows.map((row) => {
                        const timestamp = row.sent_at || row.created_at;
                        const destination = row.endpoint_url || (systemHealth.hl7ExportConfigured ? "Configured" : "Missing");
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{new Date(timestamp).toLocaleString()}</TableCell>
                            <TableCell>{row.message_type || "ORU^R01"}</TableCell>
                            <TableCell>{row.patient_mrn || "Not available"}</TableCell>
                            <TableCell>{row.exam_type || "US"}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs" title={destination}>{destination}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs" title={row.error_message || ""}>{row.error_message || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Hl7StatusBadge status={row.status} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <ReportTemplateManager />
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <BrandingSettingsManager />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="HL7 Success Rate" value={loading ? "..." : `${hl7SuccessRate ?? 0}%`} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
              <MetricCard label="Staff Accounts" value={loading ? "..." : String(staff.length)} icon={<Users className="h-5 w-5" />} accent="primary" />
              <MetricCard label="Admin Accounts" value={loading ? "..." : String(staff.filter((person) => person.role === "admin").length)} icon={<Users className="h-5 w-5" />} accent="primary" />
            </div>
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Operational Notes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Clinical workflow behavior is unchanged. This panel only adds visibility and administration controls.</li>
                <li>Missing optional fields are displayed as "Not available" to avoid breaking dashboard rendering.</li>
                <li>System configuration checks are read-only and never expose raw environment values.</li>
              </ul>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="platform" className="space-y-4">
              <PlatformControlPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create staff account</DialogTitle>
            <DialogDescription>
              Admin can create doctor or sonographer accounts for platform testing and onboarding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">Email</Label>
              <Input id="newEmail" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="user@sonolynx.local" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Temporary Password</Label>
              <Input id="newPassword" type="text" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Strong temporary password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newFirstName">First Name</Label>
                <Input id="newFirstName" value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newLastName">Last Name</Label>
                <Input id="newLastName" value={newLastName} onChange={(event) => setNewLastName(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newRole">Role</Label>
              <select
                id="newRole"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as "admin" | "doctor" | "sonographer")}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="doctor">Doctor</option>
                <option value="sonographer">Sonographer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetOrg">Organization</Label>
              <select
                id="targetOrg"
                value={targetOrgId}
                onChange={(event) => setTargetOrgId(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={!isSuperAdmin && !!organizationId}
              >
                {!isSuperAdmin && organizationId ? (
                  <option value={organizationId}>{adminOrgName || "My Organization"}</option>
                ) : (
                  organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))
                )}
              </select>
              {!isSuperAdmin && (
                <p className="text-[10px] text-muted-foreground">
                  You can only invite staff to your own organization.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creatingUser}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PricingModal
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        currentTier={orgTier}
      />

      <Dialog open={viewReportOpen} onOpenChange={setViewReportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Clinical Report Viewer</DialogTitle>
            <DialogDescription>
              Authoritative signed report content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 p-6 bg-white border rounded-md shadow-inner">
            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 leading-relaxed">
              {selectedReportText || "No report content available."}
            </pre>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setViewReportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="top-right" />
    </div>
  );
}

function Hl7StatusBadge({ status }: { status: string }) {
  const normalized = (status || "unknown").toLowerCase();

  if (normalized === "transmitted" || normalized === "sent") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Sent</Badge>;
  }

  if (normalized === "pending") {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
  }

  if (normalized === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }

  return <Badge variant="secondary">Unknown</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return <Badge className="bg-primary">Admin</Badge>;
  }
  if (role === "radiologist") {
    return <Badge variant="secondary">Radiologist</Badge>;
  }
  if (role === "sonographer") {
    return <Badge variant="secondary">Sonographer</Badge>;
  }
  if (role === "doctor") {
    return <Badge variant="secondary">Doctor</Badge>;
  }
  return <Badge variant="outline">{role || "Not available"}</Badge>;
}

function HealthCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {ok ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Configured</Badge>
        ) : (
          <Badge variant="destructive">Missing</Badge>
        )}
      </div>
    </Card>
  );
}

function FeatureCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs">{label}</span>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[accent]}`}>{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
