"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  Wifi,
  Clock,
  FileText,
  History,
  Download,
  Search,
  BadgeCheck,
  UserCheck,
  PenTool,
  Send,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBackupTimestamp } from "@/lib/auto-recovery";
import {
  getAuditLogsForCase,
  exportAuditLogsToCsv,
  type AuditLogEntry,
} from "@/lib/audit-service";
import { cn } from "@/lib/utils";

interface AutoRecoveryStatusButtonProps {
  lastBackupTime: number | null;
  isBackingUp: boolean;
  isOnline: boolean;
  patientName?: string;
  patientId?: string;
  studyId?: string;
  mrn?: string;
  exam?: string;
  keyImagesCount?: number;
  staffName?: string;
  staffEmail?: string;
  staffRole?: string;
  onManualBackup: () => void;
  onRestoreBackup?: () => void;
  hasStoredBackup?: boolean;
  className?: string;
}

export function AutoRecoveryStatusButton({
  lastBackupTime,
  isBackingUp,
  isOnline,
  patientName,
  patientId,
  studyId,
  mrn,
  exam,
  keyImagesCount = 0,
  staffName,
  staffEmail,
  staffRole,
  onManualBackup,
  onRestoreBackup,
  hasStoredBackup = false,
  className,
}: AutoRecoveryStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [activeTab, setActiveTab] = useState("recovery");
  const [searchFilter, setSearchFilter] = useState("");
  const [actionCategory, setActionCategory] = useState<string>("all");

  // Keep relative counter live
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAuditHistory = async () => {
    setLoadingAudit(true);
    try {
      const logs = await getAuditLogsForCase({ patientId, studyId });
      setAuditLogs(logs);
    } catch (err) {
      console.warn("[audit-ui] Failed to load audit history:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAuditHistory();
    }
  }, [open, patientId, studyId]);

  const formatted = formatBackupTimestamp(lastBackupTime);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((item) => {
      // Category filter
      if (actionCategory === "signatures") {
        if (!item.action.includes("sign")) return false;
      } else if (actionCategory === "edits") {
        if (!item.action.includes("draft") && !item.action.includes("edit") && !item.action.includes("worksheet")) return false;
      } else if (actionCategory === "workflow") {
        if (!item.action.includes("doctor") && !item.action.includes("correction")) return false;
      }

      // Text search
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.staffName.toLowerCase().includes(q) ||
        item.staffEmail.toLowerCase().includes(q) ||
        item.staffRole.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, actionCategory, searchFilter]);

  const renderActionBadge = (action: string) => {
    if (action.includes("sign")) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-[11px] font-semibold">
          <BadgeCheck className="h-3 w-3" /> Doctor Signature
        </Badge>
      );
    }
    if (action.includes("draft") || action.includes("worksheet")) {
      return (
        <Badge variant="outline" className="border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 gap-1 text-[11px] font-semibold">
          <FileText className="h-3 w-3 text-blue-500" /> Draft Saved
        </Badge>
      );
    }
    if (action.includes("send_to_doctor")) {
      return (
        <Badge variant="outline" className="border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 gap-1 text-[11px] font-semibold">
          <Send className="h-3 w-3 text-indigo-500" /> Sent to Doctor
        </Badge>
      );
    }
    if (action.includes("correction")) {
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 gap-1 text-[11px] font-semibold">
          <AlertCircle className="h-3 w-3 text-amber-500" /> Correction Requested
        </Badge>
      );
    }
    if (action.includes("image")) {
      return (
        <Badge variant="outline" className="border-purple-500/40 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 gap-1 text-[11px] font-semibold">
          <PenTool className="h-3 w-3 text-purple-500" /> Scan Picture Annotated
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px] font-semibold gap-1">
        <HardDrive className="h-3 w-3 text-slate-500" /> Auto-Recovery Snapshot
      </Badge>
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-7 text-xs gap-1.5 border-emerald-500/40 bg-emerald-50/40 hover:bg-emerald-50/80 text-emerald-800 dark:border-emerald-600/40 dark:bg-emerald-950/25 dark:text-emerald-300 dark:hover:bg-emerald-950/40 font-medium transition-all shadow-2xs",
          className
        )}
        title="Click to view Crash-Proof Auto-Recovery & Complete Activity Audit Trail"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">
          {isBackingUp ? "Backing up…" : `Auto-Saved · ${formatted.relative}`}
        </span>
        <span className="sm:hidden">Auto-Saved</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-border bg-card p-6 text-foreground">
          <DialogHeader className="space-y-1.5 pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                Crash-Proof Auto-Recovery & Activity Audit Trail
              </DialogTitle>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Continuous & Tamper-Evident
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Instant crash protection and permanent chronological audit recording of every change, edit, and doctor signature for legal accountability.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 pt-1">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="recovery" className="text-xs gap-1.5 font-medium">
                <HardDrive className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Auto-Recovery & Backups
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5 font-medium">
                <History className="h-3.5 w-3.5 text-blue-500" />
                Activity Audit Trail ({auditLogs.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: AUTO-RECOVERY */}
            <TabsContent value="recovery" className="space-y-3 mt-0 focus-visible:outline-none">
              {/* Primary Timestamp Hero Card */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center space-y-1 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Clock className="h-3.5 w-3.5" />
                  Last Backup Taken At
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-900 dark:text-emerald-200">
                  {formatted.absolute}
                </div>
                <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                  {formatted.relative} {lastBackupTime ? `· ${new Date(lastBackupTime).toLocaleDateString()}` : ""}
                </p>
              </div>

              {/* System & Storage Integrity Grid */}
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <HardDrive className="h-3.5 w-3.5 text-blue-500" /> Local Crash Resilience:
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Protected
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Wifi className="h-3.5 w-3.5 text-blue-500" /> Network Status:
                    </span>
                    <span className="font-medium text-foreground">
                      {isOnline ? "Online (Cloud Sync Active)" : "Offline (Local Storage Only)"}
                    </span>
                  </div>

                  {patientName && (
                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-muted-foreground">
                      <span className="font-medium">Active Case:</span>
                      <span className="font-semibold text-foreground truncate max-w-[280px]">
                        {patientName} {mrn ? `(${mrn})` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Protected In This Backup
                  </span>
                  <ul className="space-y-1 text-foreground/90">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Worksheet findings & measurements ({exam || "Ultrasound"})</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Clinical report text & custom edits</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Doctor additional notes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Attached scan pictures & red highlights ({keyImagesCount} attached)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: ACTIVITY AUDIT TRAIL */}
            <TabsContent value="audit" className="space-y-3 mt-0 focus-visible:outline-none">
              {/* Header description with accountability note */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                <div>
                  <span className="font-semibold flex items-center gap-1.5 text-foreground">
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Complete Accountability & Legal Protection
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Every edit, change, and doctor signature is stamped with exact staff identity and time.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAuditHistory}
                    className="h-7 text-xs gap-1"
                    title="Refresh latest audit entries"
                  >
                    <RefreshCw className={cn("h-3 w-3", loadingAudit && "animate-spin")} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAuditLogsToCsv(filteredLogs, patientName)}
                    disabled={!filteredLogs.length}
                    className="h-7 text-xs gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300"
                    title="Export permanent audit trail to CSV for clinic compliance"
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by staff name, action, or details..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full h-7.5 rounded-md border bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <Button
                    variant={actionCategory === "all" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActionCategory("all")}
                    className="h-6 px-2 text-[11px]"
                  >
                    All ({auditLogs.length})
                  </Button>
                  <Button
                    variant={actionCategory === "signatures" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActionCategory("signatures")}
                    className="h-6 px-2 text-[11px]"
                  >
                    Signatures
                  </Button>
                  <Button
                    variant={actionCategory === "edits" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActionCategory("edits")}
                    className="h-6 px-2 text-[11px]"
                  >
                    Edits & Drafts
                  </Button>
                  <Button
                    variant={actionCategory === "workflow" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActionCategory("workflow")}
                    className="h-6 px-2 text-[11px]"
                  >
                    Workflow
                  </Button>
                </div>
              </div>

              {/* Chronological Audit Log Timeline */}
              <div className="rounded-lg border bg-background max-h-[300px] overflow-y-auto divide-y divide-border/60">
                {loadingAudit && (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                    <span>Loading permanent audit history...</span>
                  </div>
                )}

                {!loadingAudit && filteredLogs.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-1.5">
                    <FileText className="h-6 w-6 mx-auto text-muted-foreground/60" />
                    <p className="font-medium text-foreground">No audit entries found</p>
                    <p className="text-[11px]">
                      {searchFilter ? "Try adjusting your search filter." : "New worksheet edits, changes, and signatures will be stamped here permanently."}
                    </p>
                  </div>
                )}

                {!loadingAudit &&
                  filteredLogs.map((entry) => {
                    const entryDate = new Date(entry.created_at);
                    const timeStr = entryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const dateStr = entryDate.toLocaleDateString();

                    return (
                      <div key={entry.id} className="p-3 hover:bg-muted/20 transition-colors space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            {renderActionBadge(entry.action)}
                            <span className="text-[11px] font-semibold text-foreground">
                              {entry.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground ml-auto">
                            <Clock className="h-3 w-3" />
                            <span>{timeStr}</span>
                            <span className="text-muted-foreground/60">·</span>
                            <span>{dateStr}</span>
                          </div>
                        </div>

                        {/* Staff Attribution & Legal Stamp */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="font-semibold text-foreground">{entry.staffName}</span>
                            <span className="text-muted-foreground">({entry.staffEmail})</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-slate-300 dark:border-slate-700">
                              {entry.staffRole}
                            </Badge>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="h-3 w-3" />
                            Audit Verified
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-1">
            {activeTab === "recovery" && hasStoredBackup && onRestoreBackup && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onRestoreBackup();
                  setOpen(false);
                }}
                className="gap-1.5 border-slate-700 text-xs"
                title="Restore previous local backup snapshot"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                Restore Backup
              </Button>
            )}

            {activeTab === "recovery" && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onManualBackup();
                  loadAuditHistory();
                }}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs ml-auto"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isBackingUp && "animate-spin")} />
                Back Up Now
              </Button>
            )}

            {activeTab === "audit" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs ml-auto"
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
