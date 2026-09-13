"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  CLINICAL_DOODLES,
  getDoodleById,
  useClinicalDoodle,
} from "@/lib/clinical-doodles";
import {
  useClinicalSettings,
  type ClinicalWorkspaceSettings,
} from "@/lib/clinical-settings";
import {
  Settings,
  Palette,
  Check,
  Stethoscope,
  Activity,
  ShieldCheck,
  FileText,
  Eye,
  Sliders,
  Bell,
  HardDrive,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
  Volume2,
  Monitor,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClinicalSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName?: string;
  staffEmail?: string;
  staffRole?: string;
}

export function ClinicalSettingsDialog({
  open,
  onOpenChange,
  staffName = "Clinician",
  staffEmail = "doctor@clinic.org",
  staffRole = "doctor",
}: ClinicalSettingsDialogProps) {
  const { activeDoodleId, setDoodleId } = useClinicalDoodle();
  const { settings, updateSettings, resetToDefaults } = useClinicalSettings();

  const [activeTab, setActiveTab] = useState("avatar");

  // Local state for doodle selection inside the dialog
  const [selectedDoodleId, setSelectedDoodleId] = useState<string>(activeDoodleId);
  const initialDoodleRole = staffRole.toLowerCase().includes("sono")
    ? "sonographer"
    : staffRole.toLowerCase().includes("admin")
    ? "admin"
    : "doctor";
  const [doodleRoleFilter, setDoodleRoleFilter] = useState<string>(initialDoodleRole);

  // Sync with active doodle when opened
  useEffect(() => {
    if (open) {
      setSelectedDoodleId(activeDoodleId);
    }
  }, [open, activeDoodleId]);

  const selectedDoodle = getDoodleById(selectedDoodleId) || CLINICAL_DOODLES[0];

  const filteredDoodles = CLINICAL_DOODLES.filter((doodle) => {
    if (doodleRoleFilter === "all") return true;
    if (doodleRoleFilter === "doctor") return doodle.role === "doctor" || doodle.role === "general";
    if (doodleRoleFilter === "sonographer") return doodle.role === "sonographer" || doodle.role === "general";
    if (doodleRoleFilter === "admin") return doodle.role === "admin" || doodle.role === "general";
    return true;
  });

  const handleApplyDoodle = (id: string) => {
    setSelectedDoodleId(id);
    setDoodleId(id);
    updateSettings({ doodleId: id });
    const doodle = getDoodleById(id);
    toast.success("Avatar Doodle Updated", {
      description: `Your clinical avatar is set to "${doodle?.name || "Clinical Avatar"}".`,
    });
  };

  const handleUseInitials = () => {
    setSelectedDoodleId("");
    setDoodleId("");
    updateSettings({ doodleId: "" });
    toast.info("Avatar Set to Initials", {
      description: "Reverted your avatar to standard clinical initials.",
    });
  };

  const handleClearCache = () => {
    try {
      // Clear sonolynx backup snapshots if user requested
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sonolynx_crashproof_") || key.startsWith("sonolynx_last_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      toast.success("Cache Cleared", {
        description: `Purged ${keysToRemove.length} temporary session cache keys.`,
      });
    } catch {
      toast.error("Failed to clear local cache.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-border bg-card p-6 text-foreground sm:rounded-xl shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground border border-border">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </span>
              Clinical Settings & Preferences
            </DialogTitle>
            <Badge variant="outline" className="text-[11px] font-medium border-border bg-muted/40 text-muted-foreground">
              {staffRole.toUpperCase()} · v2.4
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Personalize your doodle avatar, clinical reporting defaults, scan viewer aesthetics, and crash protection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 pt-1">
          <TabsList className="grid w-full grid-cols-5 h-9">
            <TabsTrigger value="avatar" className="text-xs gap-1 font-medium">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Avatar & Doodles</span>
              <span className="sm:hidden">Avatar</span>
            </TabsTrigger>
            <TabsTrigger value="clinical" className="text-xs gap-1 font-medium">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Reporting</span>
              <span className="sm:hidden">Report</span>
            </TabsTrigger>
            <TabsTrigger value="recovery" className="text-xs gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Auto-Recovery</span>
              <span className="sm:hidden">Recovery</span>
            </TabsTrigger>
            <TabsTrigger value="viewer" className="text-xs gap-1 font-medium">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Scan Viewer</span>
              <span className="sm:hidden">Viewer</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs gap-1 font-medium">
              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Account & Safety</span>
              <span className="sm:hidden">Account</span>
            </TabsTrigger>
          </TabsList>

          {/* ============================================================== */}
          {/* TAB 1: AVATAR & DOODLE PICKER (All doodle features in Settings) */}
          {/* ============================================================== */}
          <TabsContent value="avatar" className="space-y-3.5 mt-0 focus-visible:outline-none">
            {/* Live Preview Hero Card */}
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border bg-muted/20 p-4 transition-all">
              <div className="relative flex h-18 w-18 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-background p-2 shadow-xs">
                {selectedDoodleId ? (
                  selectedDoodle.render({ className: "h-full w-full drop-shadow-xs" })
                ) : (
                  <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {staffName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {selectedDoodleId && (
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-sm font-bold text-foreground truncate">
                    {selectedDoodleId ? selectedDoodle.name : "Clinical Initials"}
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                    {selectedDoodleId ? selectedDoodle.categoryLabel : "Default"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {selectedDoodleId
                    ? selectedDoodle.description
                    : "Using standard two-letter monogram avatar based on your clinician account profile."}
                </p>
                <div className="pt-0.5 flex items-center justify-center sm:justify-start gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{staffName}</span>
                  <span>·</span>
                  <span className="capitalize">{staffRole}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedDoodleId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseInitials}
                    className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
                  >
                    Use Initials
                  </Button>
                )}
              </div>
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Select Role Illustration:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <Button
                  type="button"
                  variant={doodleRoleFilter === "doctor" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDoodleRoleFilter("doctor")}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <Stethoscope className="h-3 w-3" />
                  Doctor
                </Button>
                <Button
                  type="button"
                  variant={doodleRoleFilter === "sonographer" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDoodleRoleFilter("sonographer")}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <Activity className="h-3 w-3" />
                  Sonographer
                </Button>
                <Button
                  type="button"
                  variant={doodleRoleFilter === "admin" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDoodleRoleFilter("admin")}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Button>
                <Button
                  type="button"
                  variant={doodleRoleFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setDoodleRoleFilter("all")}
                  className="h-7 text-xs px-2.5"
                >
                  All ({CLINICAL_DOODLES.length})
                </Button>
              </div>
            </div>

            {/* Doodles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[280px] overflow-y-auto p-1 border rounded-lg bg-background/50">
              {filteredDoodles.map((doodle) => {
                const isSelected = selectedDoodleId === doodle.id;
                return (
                  <button
                    key={doodle.id}
                    type="button"
                    onClick={() => handleApplyDoodle(doodle.id)}
                    className={cn(
                      "group relative flex flex-col items-center rounded-lg border p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/70 hover:border-foreground/30 hover:bg-muted/40"
                    )}
                  >
                    <div className="relative mb-2 flex h-13 w-13 items-center justify-center rounded-full border border-border/80 bg-background p-1.5 transition-transform group-hover:scale-105">
                      {doodle.render({ className: "h-full w-full" })}
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground line-clamp-1">
                      {doodle.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {doodle.categoryLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 2: CLINICAL PREFERENCES & REPORTING DEFAULTS */}
          {/* ============================================================== */}
          <TabsContent value="clinical" className="space-y-3.5 mt-0 focus-visible:outline-none">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Measurement Units
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Standardize organ dimensions and nodule metrics across ultrasound worksheets.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.measurementUnit === "metric" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ measurementUnit: "metric" })}
                    className="h-7 text-xs px-2.5 font-medium"
                  >
                    Metric (cm / mm)
                  </Button>
                  <Button
                    type="button"
                    variant={settings.measurementUnit === "imperial" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ measurementUnit: "imperial" })}
                    className="h-7 text-xs px-2.5 font-medium"
                  >
                    Imperial (in)
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Default Report Style
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Initial layout for clinical report generation before manual adjustments.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.defaultReportStyle === "standard" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ defaultReportStyle: "standard" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Standard Impression
                  </Button>
                  <Button
                    type="button"
                    variant={settings.defaultReportStyle === "structured" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ defaultReportStyle: "structured" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Structured Findings
                  </Button>
                  <Button
                    type="button"
                    variant={settings.defaultReportStyle === "concise" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ defaultReportStyle: "concise" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Concise
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Scan Markup Highlighter Color
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Color used when drawing clinical callouts and pointers directly on ultrasound frames.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { hex: "#ef4444", label: "Crimson Red" },
                    { hex: "#f59e0b", label: "Amber" },
                    { hex: "#0ea5e9", label: "Sky Blue" },
                    { hex: "#10b981", label: "Emerald" },
                  ].map((color) => {
                    const isSelected = settings.markupColor === color.hex;
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => updateSettings({ markupColor: color.hex })}
                        style={{ backgroundColor: color.hex }}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          isSelected
                            ? "border-foreground ring-2 ring-primary scale-110"
                            : "border-transparent opacity-80 hover:opacity-100"
                        )}
                        title={color.label}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Auto-Scroll Findings to Report Selection
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Keep the clinical report synchronized when clicking individual organ findings.
                  </p>
                </div>
                <Switch
                  checked={settings.autoScrollFindings}
                  onCheckedChange={(checked) => updateSettings({ autoScrollFindings: checked })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 3: CRASH PROTECTION & AUTO-RECOVERY SAFETY */}
          {/* ============================================================== */}
          <TabsContent value="recovery" className="space-y-3.5 mt-0 focus-visible:outline-none">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Background Auto-Save Frequency
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Debounce delay between continuous background snapshot captures.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.autoSaveIntervalMs === 1500 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ autoSaveIntervalMs: 1500 })}
                    className="h-7 text-xs px-2.5"
                  >
                    Instant (1.5s)
                  </Button>
                  <Button
                    type="button"
                    variant={settings.autoSaveIntervalMs === 3000 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ autoSaveIntervalMs: 3000 })}
                    className="h-7 text-xs px-2.5"
                  >
                    3.0s
                  </Button>
                  <Button
                    type="button"
                    variant={settings.autoSaveIntervalMs === 5000 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ autoSaveIntervalMs: 5000 })}
                    className="h-7 text-xs px-2.5"
                  >
                    5.0s
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Periodic Heartbeat Snapshot Interval
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Secondary background timer safeguarding work during long uninterrupted writing sessions.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.heartbeatIntervalSec === 12 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ heartbeatIntervalSec: 12 })}
                    className="h-7 text-xs px-2.5"
                  >
                    12s
                  </Button>
                  <Button
                    type="button"
                    variant={settings.heartbeatIntervalSec === 30 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ heartbeatIntervalSec: 30 })}
                    className="h-7 text-xs px-2.5"
                  >
                    30s
                  </Button>
                  <Button
                    type="button"
                    variant={settings.heartbeatIntervalSec === 60 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ heartbeatIntervalSec: 60 })}
                    className="h-7 text-xs px-2.5"
                  >
                    60s
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Browser Tab Close Guard
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Prompt a confirmation alert before closing the tab if uncommitted changes exist.
                  </p>
                </div>
                <Switch
                  checked={settings.warnBeforeUnload}
                  onCheckedChange={(checked) => updateSettings({ warnBeforeUnload: checked })}
                />
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Audio Chime on Report Signature
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Play a subtle clinical chime confirming report sign & submission.
                  </p>
                </div>
                <Switch
                  checked={settings.soundOnReportSign}
                  onCheckedChange={(checked) => updateSettings({ soundOnReportSign: checked })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 4: DICOM & SCAN VIEWER APPEARANCE */}
          {/* ============================================================== */}
          <TabsContent value="viewer" className="space-y-3.5 mt-0 focus-visible:outline-none">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Scan Vignette / Eye Mask Effect
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Subtle curved aperture rendering for ultrasound scans without clipping peripheral frames.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.eyeMaskStyle === "almond_soft" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ eyeMaskStyle: "almond_soft" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Almond Soft (Default)
                  </Button>
                  <Button
                    type="button"
                    variant={settings.eyeMaskStyle === "crisp" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ eyeMaskStyle: "crisp" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Crisp Border
                  </Button>
                  <Button
                    type="button"
                    variant={settings.eyeMaskStyle === "disabled" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ eyeMaskStyle: "disabled" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Square (Off)
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    DICOM Viewer Backdrop
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Aesthetic contrast background for viewing ultrasound cine loops and key frames.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.viewerBackground === "pure_black" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ viewerBackground: "pure_black" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Deep Pure Black
                  </Button>
                  <Button
                    type="button"
                    variant={settings.viewerBackground === "dark_slate" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ viewerBackground: "dark_slate" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Dark Slate
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Interface Density
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Adjust row padding and spacing in worksheet measurements and lists.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <Button
                    type="button"
                    variant={settings.uiDensity === "comfortable" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ uiDensity: "comfortable" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Comfortable
                  </Button>
                  <Button
                    type="button"
                    variant={settings.uiDensity === "compact" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateSettings({ uiDensity: "compact" })}
                    className="h-7 text-xs px-2.5"
                  >
                    Compact (High-Density)
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 5: ACCOUNT & COMPLIANCE SAFETY */}
          {/* ============================================================== */}
          <TabsContent value="account" className="space-y-3.5 mt-0 focus-visible:outline-none">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Clinician Profile
                  </span>
                  <div className="text-sm font-semibold text-foreground pt-1">{staffName}</div>
                  <div className="text-xs text-muted-foreground">{staffEmail}</div>
                </div>
                <Badge variant="outline" className="border-border text-foreground text-xs font-semibold uppercase px-3 py-1">
                  {staffRole}
                </Badge>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    HIPAA Compliance & Legal Audit Trail
                  </span>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Continuous tamper-evident timestamping active for legal accountability.
                  </p>
                </div>
                <Badge className="bg-emerald-600/90 text-white text-[10px] font-semibold">
                  Active & Verified
                </Badge>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">Local Session Storage</span>
                  <p className="text-[11px] text-muted-foreground">
                    Purge cached crash snapshots stored in this browser if needed.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearCache}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Local Cache
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t mt-1">
          <span className="text-xs text-muted-foreground my-auto mr-auto hidden sm:inline">
            Preferences save automatically to your workstation profile.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            className="text-xs mr-2"
          >
            Reset Defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
