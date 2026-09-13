"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, RotateCcw, CheckCircle2, HardDrive, Wifi, Clock, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBackupTimestamp, type SessionBackup } from "@/lib/auto-recovery";
import { cn } from "@/lib/utils";

interface AutoRecoveryStatusButtonProps {
  lastBackupTime: number | null;
  isBackingUp: boolean;
  isOnline: boolean;
  patientName?: string;
  mrn?: string;
  exam?: string;
  keyImagesCount?: number;
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
  mrn,
  exam,
  keyImagesCount = 0,
  onManualBackup,
  onRestoreBackup,
  hasStoredBackup = false,
  className,
}: AutoRecoveryStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Update relative time counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatted = formatBackupTimestamp(lastBackupTime);

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
        title="Click to view last backup time and crash-proof auto-recovery status"
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
        <DialogContent className="max-w-md border-border bg-card p-6 text-foreground">
          <DialogHeader className="space-y-1.5 pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                Crash-Proof Auto-Recovery
              </DialogTitle>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Continuous
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Continuous background snapshots protect against sudden computer reboots, internet drops, and accidental tab closures. Zero work is lost.
            </DialogDescription>
          </DialogHeader>

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
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
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

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            {hasStoredBackup && onRestoreBackup && (
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

            <Button
              type="button"
              size="sm"
              onClick={() => {
                onManualBackup();
              }}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isBackingUp && "animate-spin")} />
              Back Up Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
