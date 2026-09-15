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
  ArrowLeft,
  Trash2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Ruler,
  Activity,
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
import {
  formatBackupTimestamp,
  getAllSessionBackups,
  deleteSessionBackup,
  type SessionBackup,
} from "@/lib/auto-recovery";
import {
  getAuditLogsForCase,
  exportAuditLogsToCsv,
  type AuditLogEntry,
} from "@/lib/audit-service";
import { getDoodleById, getDefaultDoodleForRole } from "@/lib/clinical-doodles";
import { extractBackupReadings } from "@/lib/backup-readings-extractor";
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
  onRestoreBackup?: (backup?: SessionBackup) => void;
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
  const [view, setView] = useState<"main" | "restore_picker">("main");
  const [backupsList, setBackupsList] = useState<SessionBackup[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<SessionBackup | null>(null);
  const [now, setNow] = useState(Date.now());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [activeTab, setActiveTab] = useState("recovery");
  const [searchFilter, setSearchFilter] = useState("");
  const [actionCategory, setActionCategory] = useState<string>("all");
  const [expandedBackups, setExpandedBackups] = useState<Record<string, boolean>>({});

  const toggleExpandBackup = (backupId: string) => {
    setExpandedBackups((prev) => ({
      ...prev,
      [backupId]: !prev[backupId],
    }));
  };

  const refreshBackups = () => {
    if (!patientId) return;
    const list = getAllSessionBackups(patientId);
    setBackupsList(list);
  };

  useEffect(() => {
    if (open && patientId) {
      refreshBackups();
    }
  }, [open, patientId, lastBackupTime]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setView("main");
      setConfirmTarget(null);
    }
  };

  const handleExecuteRestore = (backup: SessionBackup) => {
    if (onRestoreBackup) {
      onRestoreBackup(backup);
    }
    setOpen(false);
    setView("main");
    setConfirmTarget(null);
  };

  const handleDeleteSnapshot = (e: React.MouseEvent, backupId: string) => {
    e.stopPropagation();
    if (!patientId) return;
    const updated = deleteSessionBackup(patientId, backupId);
    setBackupsList(updated);
    if (confirmTarget?.backupId === backupId) {
      setConfirmTarget(null);
    }
  };

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
          "h-7 text-xs gap-1.5 border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors shadow-2xs",
          className
        )}
        title="Click to view Crash-Proof Auto-Recovery & Complete Activity Audit Trail"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">
          {isBackingUp ? "Backing up…" : `Auto-Saved · ${formatted.relative}`}
        </span>
        <span className="sm:hidden">Auto-Saved</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl border-border bg-card p-6 text-foreground">
          {view === "main" ? (
            <>
              <DialogHeader className="space-y-1.5 pb-2 border-b">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground border border-border">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </span>
                    Crash-Proof Auto-Recovery & Activity Audit Trail
                  </DialogTitle>
                  <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground text-[11px] font-medium">
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
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    Auto-Recovery & Backups
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs gap-1.5 font-medium">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    Activity Audit Trail ({auditLogs.length})
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: AUTO-RECOVERY */}
                <TabsContent value="recovery" className="space-y-3 mt-0 focus-visible:outline-none">
                  {/* Primary Timestamp Hero Card */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-center space-y-1 shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Last Backup Taken At
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                      {formatted.absolute}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
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
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" /> Protected
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
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Worksheet findings & measurements ({exam || "Ultrasound"})</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Clinical report text & custom edits</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Doctor additional notes</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Attached scan pictures & red highlights ({keyImagesCount} attached)</span>
                        </li>
                      </ul>
                    </div>

                    {/* Available Snapshots Summary */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <HardDrive className="h-3.5 w-3.5" />
                          Saved Session Snapshots ({backupsList.length})
                        </span>
                        {backupsList.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              refreshBackups();
                              setView("restore_picker");
                            }}
                            className="h-6 text-[11px] text-foreground hover:text-foreground font-medium px-2"
                          >
                            View all & restore →
                          </Button>
                        )}
                      </div>
                      {backupsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No snapshot saved yet. Snapshots will appear automatically as you work.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {backupsList.slice(0, 2).map((item, idx) => {
                            const itemTime = formatBackupTimestamp(item.savedAt);
                            const itemReadings = extractBackupReadings(item);
                            return (
                              <div
                                key={item.backupId}
                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-background/70 border border-border/40 gap-2"
                              >
                                <div className="flex items-center gap-2 truncate min-w-0">
                                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono font-bold text-foreground shrink-0">{itemTime.absolute}</span>
                                  <span className="text-muted-foreground text-[11px] shrink-0">({itemTime.relative})</span>
                                  {idx === 0 && (
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-primary/40 text-primary shrink-0">
                                      Latest
                                    </Badge>
                                  )}
                                  {itemReadings.measurements.length > 0 ? (
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                                      <Ruler className="h-2.5 w-2.5 text-sky-500 shrink-0" />
                                      {itemReadings.measurements.slice(0, 2).map((m) => `${m.label}: ${m.value}`).join(" · ")}
                                    </span>
                                  ) : (
                                    <span className="hidden sm:inline text-[10px] text-muted-foreground/70 italic truncate">
                                      Worksheet draft
                                    </span>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    refreshBackups();
                                    setConfirmTarget(item);
                                    setView("restore_picker");
                                  }}
                                  className="h-6 text-[11px] px-2 gap-1 text-foreground shrink-0"
                                >
                                  <RotateCcw className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  Restore
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: ACTIVITY AUDIT TRAIL */}
                <TabsContent value="audit" className="space-y-3 mt-0 focus-visible:outline-none">
                  {/* Header description with accountability note */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                    <div>
                      <span className="font-semibold flex items-center gap-1.5 text-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
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
                        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={actionCategory === "all" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActionCategory("all")}
                        className="h-8 text-xs px-2"
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant={actionCategory === "signatures" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActionCategory("signatures")}
                        className="h-8 text-xs px-2 gap-1"
                      >
                        <BadgeCheck className="h-3 w-3" />
                        Signatures
                      </Button>
                      <Button
                        type="button"
                        variant={actionCategory === "edits" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActionCategory("edits")}
                        className="h-8 text-xs px-2 gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        Edits
                      </Button>
                      <Button
                        type="button"
                        variant={actionCategory === "workflow" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActionCategory("workflow")}
                        className="h-8 text-xs px-2 gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Workflow
                      </Button>
                    </div>
                  </div>

                  {/* Scrollable Audit Log Entries */}
                  <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                    {loadingAudit && (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Loading audit log entries…
                      </div>
                    )}

                    {!loadingAudit && filteredLogs.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                        No audit events recorded matching your filter.
                      </div>
                    )}

                    {!loadingAudit &&
                      filteredLogs.map((entry) => {
                        const dateObj = new Date(entry.created_at);
                        const timeStr = dateObj.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });
                        const dateStr = dateObj.toLocaleDateString();

                        return (
                          <div
                            key={entry.id}
                            className="rounded-lg border bg-card p-2.5 text-xs space-y-1.5 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
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
                                {(() => {
                                  const staffDoodle = getDoodleById(getDefaultDoodleForRole(entry.staffRole));
                                  if (staffDoodle) {
                                    return (
                                      <span className="h-4 w-4 shrink-0 rounded-full bg-muted/40 p-0.5 border border-border/60 flex items-center justify-center" title={`${staffDoodle.name} (${entry.staffRole})`}>
                                        {staffDoodle.render({ className: "h-full w-full" })}
                                      </span>
                                    );
                                  }
                                  return <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
                                })()}
                                <span className="font-semibold text-foreground">{entry.staffName}</span>
                                <span className="text-muted-foreground">({entry.staffEmail})</span>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 border-slate-300 dark:border-slate-700">
                                  {entry.staffRole}
                                </Badge>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <BadgeCheck className="h-3 w-3 text-muted-foreground" />
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
                {activeTab === "recovery" && (hasStoredBackup || backupsList.length > 0) && onRestoreBackup && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      refreshBackups();
                      setView("restore_picker");
                    }}
                    className="gap-1.5 border-slate-700 text-xs"
                    title="View all saved backups and choose which one to restore"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Restore Backup {backupsList.length > 0 ? `(${backupsList.length})` : ""}
                  </Button>
                )}

                {activeTab === "recovery" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onManualBackup();
                      loadAuditHistory();
                      refreshBackups();
                    }}
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs ml-auto"
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
            </>
          ) : (
            <>
              {/* VIEW 2: RESTORE SNAPSHOT PICKER */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setView("main");
                      setConfirmTarget(null);
                    }}
                    className="h-8 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <div>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Choose Backup to Restore
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Select a snapshot below to restore your worksheet, findings, and attached pictures.
                    </DialogDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {backupsList.length} {backupsList.length === 1 ? "snapshot" : "snapshots"}
                </Badge>
              </div>

              <div className="rounded-lg border bg-muted/30 p-2.5 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Select the snapshot you want to restore. The system will ask for your confirmation before restoring.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={refreshBackups}
                  className="h-6 text-[11px] px-2 gap-1 shrink-0"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>

              <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                {backupsList.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
                    <HardDrive className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm font-medium text-foreground">No Backup Snapshots Saved Yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      As you edit findings, add clinical notes, or attach ultrasound scans, the system continuously creates local snapshots. You can also click "Back Up Now" anytime.
                    </p>
                  </div>
                ) : (
                  backupsList.map((backup, index) => {
                    const itemTime = formatBackupTimestamp(backup.savedAt);
                    const isConfirming = confirmTarget?.backupId === backup.backupId;

                    if (isConfirming) {
                      const targetReadings = extractBackupReadings(backup);
                      return (
                        <div
                          key={backup.backupId}
                          className="rounded-lg border-2 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-3 shadow-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-1 text-xs flex-1">
                              <p className="font-semibold text-foreground text-sm">
                                Restore backup from {itemTime.absolute}?
                              </p>
                              <p className="text-muted-foreground leading-relaxed">
                                This will replace your current worksheet findings, doctor notes, and report draft with this snapshot from{" "}
                                <span className="font-medium text-foreground">{itemTime.relative}</span> ({new Date(backup.savedAt).toLocaleDateString()}).
                              </p>

                              {/* Clinical Readings Being Restored */}
                              <div className="rounded-md border border-blue-200/80 dark:border-blue-900/60 bg-white/95 dark:bg-slate-900/90 p-2.5 space-y-2 mt-2 shadow-2xs">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Ruler className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    Exact Readings in this Snapshot:
                                  </span>
                                  <Badge variant="outline" className="border-border/80 text-[10px] text-muted-foreground bg-muted/30 font-mono">
                                    {targetReadings.totalMeasurementsCount} measurement{targetReadings.totalMeasurementsCount === 1 ? "" : "s"}
                                  </Badge>
                                </div>

                                {targetReadings.measurements.length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {targetReadings.measurements.map((m, idx) => (
                                      <div key={idx} className="rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2 py-1 text-[11px]">
                                        <span className="text-muted-foreground block text-[10px]">{m.organ}</span>
                                        <span className="font-mono font-semibold text-foreground">{m.label}: {m.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground italic">
                                    No numeric measurements recorded in this snapshot (initial baseline draft).
                                  </p>
                                )}

                                {targetReadings.findings.length > 0 && (
                                  <div className="pt-1.5 border-t border-border/60 space-y-1">
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                      Organ Findings & Observations:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {targetReadings.findings.map((f, idx) => (
                                        <span
                                          key={idx}
                                          className="text-[10px] px-2 py-0.5 rounded border font-medium bg-slate-50 dark:bg-slate-800/80 text-foreground border-slate-200/80 dark:border-slate-700/80"
                                        >
                                          <span className="text-muted-foreground font-normal">{f.organ}: </span>
                                          <span>{f.finding}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {targetReadings.notesSnippet && (
                                  <div className="pt-1.5 border-t border-border/60 text-[11px] text-slate-600 dark:text-slate-300">
                                    <span className="font-semibold text-foreground">Notes: </span>
                                    <span className="italic">"{targetReadings.notesSnippet}"</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
                                <span>Exam: <strong className="text-foreground">{backup.exam}</strong></span>
                                <span>Attached scans: <strong className="text-foreground">{backup.keyImages?.length || 0}</strong></span>
                                {backup.editedReportText && (
                                  <span>Custom report: <strong className="text-foreground">{backup.editedReportText.length} chars</strong></span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmTarget(null)}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleExecuteRestore(backup)}
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-sm"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Confirm & Restore
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    const readings = extractBackupReadings(backup);
                    const isExpanded = Boolean(expandedBackups[backup.backupId]);

                    return (
                      <div
                        key={backup.backupId}
                        className={cn(
                          "rounded-lg border bg-card p-3 transition-all text-xs hover:border-foreground/30 hover:bg-muted/10 space-y-2.5",
                          index === 0 && "border-primary/40 bg-primary/[0.02]"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-sm font-bold text-foreground">
                              {itemTime.absolute}
                            </span>
                            <span className="text-muted-foreground font-medium text-xs">
                              ({itemTime.relative})
                            </span>
                            <span className="text-muted-foreground/60 text-[11px]">
                              {new Date(backup.savedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {index === 0 && (
                              <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 text-[10px] py-0 h-5 font-semibold">
                                Most Recent
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] py-0 h-5 text-muted-foreground">
                              {backup.source === "manual"
                                ? "Manual Save"
                                : backup.source === "beforeunload"
                                ? "Pre-Close Guard"
                                : "Auto-Save Draft"}
                            </Badge>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                          <div>
                            <span className="text-muted-foreground/70">Exam:</span>{" "}
                            <span className="font-medium text-foreground">{backup.exam}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground/70">Scans attached:</span>{" "}
                            <span className="font-medium text-foreground">{backup.keyImages?.length || 0} pictures</span>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-muted-foreground/70">Report status:</span>{" "}
                            <span className="font-medium text-foreground">
                              {backup.editedReportText ? "Custom edits" : "Worksheet draft"}
                            </span>
                          </div>
                        </div>

                        {/* Measurements and Readings Section */}
                        <div className="rounded-md bg-muted/40 border border-border/50 p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Ruler className="h-3 w-3 text-sky-500" />
                              Readings & Measurements:
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandBackup(backup.backupId)}
                              className="h-5 px-1.5 text-[10px] gap-1 text-sky-700 dark:text-sky-300 hover:text-foreground font-medium"
                            >
                              {isExpanded ? (
                                <>
                                  Hide Details <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Inspect All ({readings.totalMeasurementsCount + readings.findings.length}) <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                          </div>

                          {readings.measurements.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {readings.measurements.slice(0, 4).map((m, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded bg-background border border-border/60 text-foreground font-mono text-[11px] shadow-2xs"
                                >
                                  <span className="text-muted-foreground mr-1 text-[10px] font-sans">{m.organ}:</span>
                                  <strong className="font-semibold">{m.label.replace("Caliber", "").replace("Length", "").replace("Span", "").trim()} {m.value}</strong>
                                </span>
                              ))}
                              {readings.measurements.length > 4 && !isExpanded && (
                                <span className="text-[10px] text-muted-foreground font-medium px-1">
                                  +{readings.measurements.length - 4} more readings
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/80 italic">
                              {readings.hasAnyData
                                ? "Findings recorded without numeric dimensions"
                                : "Blank worksheet baseline draft"}
                            </p>
                          )}

                          {/* Expanded Clinical Readings Drawer */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-border/50 space-y-2 mt-1">
                              {readings.measurements.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    All Recorded Measurements:
                                  </span>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {readings.measurements.map((m, idx) => (
                                      <div key={idx} className="rounded bg-background border border-border/60 p-1.5 text-[11px]">
                                        <div className="text-[10px] text-muted-foreground">{m.organ}</div>
                                        <div className="font-mono font-bold text-foreground">{m.label}: {m.value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {readings.findings.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-border/40">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    Clinical Findings & Observations:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {readings.findings.map((f, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] px-2 py-0.5 rounded border font-medium bg-slate-50 dark:bg-slate-800/80 text-foreground border-slate-200/80 dark:border-slate-700/80"
                                      >
                                        <span className="text-muted-foreground font-normal">{f.organ}: </span>
                                        <span>{f.finding}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {readings.notesSnippet && (
                                <div className="rounded bg-background/80 border border-border/50 p-2 text-[11px] text-muted-foreground space-y-0.5">
                                  <span className="font-semibold text-foreground block text-[10px] uppercase tracking-wider">
                                    Clinician Notes:
                                  </span>
                                  <p className="italic font-sans text-foreground/90">"{readings.notesSnippet}"</p>
                                </div>
                              )}

                              {readings.reportSnippet && (
                                <div className="rounded bg-background/80 border border-border/50 p-2 text-[11px] text-muted-foreground space-y-0.5">
                                  <span className="font-semibold text-foreground block text-[10px] uppercase tracking-wider">
                                    Draft Report Excerpt:
                                  </span>
                                  <p className="italic font-sans text-foreground/90 font-mono text-[10.5px]">"{readings.reportSnippet}"</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {backup.backupId.slice(0, 8)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeleteSnapshot(e, backup.backupId)}
                              title="Delete this snapshot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={index === 0 ? "default" : "outline"}
                              onClick={() => setConfirmTarget(backup)}
                              className="h-7 text-xs gap-1 font-medium"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Choose to Restore
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-2">
                <span className="text-xs text-muted-foreground my-auto mr-auto hidden sm:inline">
                  Choose a snapshot to preview and confirm before restoring.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setView("main");
                    setConfirmTarget(null);
                  }}
                  className="text-xs"
                >
                  Back to Overview
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
